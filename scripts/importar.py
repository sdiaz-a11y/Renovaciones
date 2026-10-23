#!/usr/bin/env python3
"""Convierte el Excel de RENOVACIONES en el JSON base del CRM.

Uso:  python3 scripts/importar.py "<ruta al .xlsx>" <salida.json>

- Lee el .xlsx directo (zip + XML), sin dependencias.
- Normaliza teléfonos a formato internacional para links de WhatsApp.
- Fusiona a la misma persona cuando aparece en varias hojas (mismo email).
- Traduce los estados del Excel a los estados del CRM y detecta motivos
  de "no interesado" y personas que pidieron no ser contactadas.

La salida contiene datos personales: NO la guardes dentro del proyecto.
"""
import datetime
import hashlib
import json
import re
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
T = '{%s}t' % NS['m']

# Hojas por ciudad de EUA: el nombre de la hoja es la sede
SEDES_HOJA = {'TAMPA', 'ORLANDO', 'MIAMI', 'DALLAS', 'CHICAGO', 'HOUSTON', 'AUSTIN'}

PAISES = [  # (patrón en la columna LADA, país, código)
    (r'm[eé]xico|^mx', 'México', '52'),
    (r'estados unidos', 'Estados Unidos', '1'),
    (r'colombia', 'Colombia', '57'),
    (r'ecuador', 'Ecuador', '593'),
    (r'per[uú]', 'Perú', '51'),
    (r'chile', 'Chile', '56'),
    (r'guatemala', 'Guatemala', '502'),
    (r'argentina', 'Argentina', '54'),
    (r'dominicana', 'República Dominicana', '1'),
    (r'panam[aá]', 'Panamá', '507'),
    (r'costa rica', 'Costa Rica', '506'),
    (r'venezuela', 'Venezuela', '58'),
    (r'espa[nñ]a', 'España', '34'),
    (r'honduras', 'Honduras', '504'),
    (r'paraguay', 'Paraguay', '595'),
    (r'italia', 'Italia', '39'),
    (r'bolivia', 'Bolivia', '591'),
]

ESTADOS = {
    'RENOVADO': 'renovado', 'MAS+ 24': 'renovado',
    'INTERESADO': 'interesado', 'INTERESADO PARA RENOVACIÓN': 'interesado',
    'INTERESADA PARA RENOVACIÓN': 'interesado',
    'NO INTERESADO': 'no_interesado', 'NO INTERESADA': 'no_interesado',
    'CONTACTADO': 'contactado',
    'SIN RESPUESTA': 'sin_respuesta',
    '#INVALIDO': 'invalido', 'ERROR EN NÚMERO': 'invalido',
}
# Si la misma persona aparece en varias hojas, gana el estado más avanzado
RANGO = ['pendiente', 'invalido', 'sin_respuesta', 'contactado', 'no_interesado', 'interesado', 'renovado']

# El primer patrón que coincide define el motivo principal
MOTIVOS = [
    ('reembolso', r'reembols|devoluci|estaf'),
    ('soporte', r'soporte|acompa[nñ]amiento|no pud[oe] (entrar|acceder)|nunca pudo|plataforma|hacerlo funcionar|ser humano'),
    ('no_le_gusto', r'mala experiencia|p[eé]sima|no le gust|no le agrad|enojad|religios'),
    ('no_aprovecho', r'no (lo )?(aprovech|us[oó]|utiliz)|no le sirvi|no le funcion|t[eé]cni(si|ci)smos|no siente que|no le sirve'),
    ('tiempo', r'tiempo|trabajo|viaja|ocupad'),
    ('dinero', r'dinero|econ[oó]mic|pagar|invertir|inversi|gastos|financ'),
    ('salud', r'salud|personal|familia'),
    ('pausa', r'pausa|siguiente a[nñ]o|m[aá]s adelante'),
    ('otros_proyectos', r'otros? proyectos?|con alfredo|ya compr'),
]
NO_CONTACTAR = re.compile(
    r'no (quiere|desea) que (lo|la|le)s? (vuelvan|sigan|est[eé]n|molest|busqu|llam|contact)'
    r'|no (llamar|contactar|molestar)|no lo vuelvan|no la vuelvan|que no (lo|la) (busquen|molesten|llamen)', re.I)

SEDE_ALIAS = {
    'ciudad de mexico': 'CDMX', 'cdmx': 'CDMX', 'df': 'CDMX', 'cd de mexico': 'CDMX', 'cd mx': 'CDMX',
    'estado de mexico': 'Estado de México', 'edo mex': 'Estado de México', 'edomex': 'Estado de México',
    'nuevo leon': 'Nuevo León', 'yucatan': 'Yucatán', 'queretaro': 'Querétaro', 'michoacan': 'Michoacán',
    'san luis potosi': 'San Luis Potosí', 'ny': 'Nueva York', 'new york': 'Nueva York',
    'tamulipas': 'Tamaulipas', 'verecruz': 'Veracruz', 'lv': 'Las Vegas',
    'no asignada': '', 'no asignado': '', 'n/a': '', 'na': '',
}
MINUS = {'de', 'del', 'la', 'las', 'los', 'y', 'e'}
EQUIPO = {'MARISOL': 'Marisol', 'HANNAH': 'Hannah', 'JACOB': 'Jacob', 'GALI': 'Galis', 'GALIS': 'Galis'}


def sin_acentos(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def limpiar_nombre(s, email):
    """Quita emojis/símbolos al inicio o final; si no quedan letras, usa la parte del correo antes de @."""
    s = re.sub(r'^[\W\d_]+|[\W\d_]+$', '', (s or '').strip())
    if not re.search(r'[^\W\d_]', s):
        usuario = re.sub(r'[\d._-]+', ' ', (email or '').split('@')[0]).strip()
        return titulo(usuario) if usuario else 'Sin nombre'
    return titulo(s)


def titulo(s):
    s = re.sub(r'\s+', ' ', (s or '').strip())
    if not s:
        return ''
    if s.isupper() or s.islower():
        partes = s.lower().split(' ')
        return ' '.join(p if (i and p in MINUS) else p[:1].upper() + p[1:] for i, p in enumerate(partes))
    return s


def leer_xlsx(ruta):
    z = zipfile.ZipFile(ruta)
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            ss.append(''.join(t.text or '' for t in si.iter(T)))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    destino = {r.get('Id'): r.get('Target') for r in rels}
    hojas = []
    for sh in wb.find('m:sheets', NS):
        target = destino[sh.get('{%s}id' % NS['r'])].lstrip('/')
        path = target if target.startswith('xl/') else 'xl/' + target
        filas = []
        for row in ET.fromstring(z.read(path)).iter('{%s}row' % NS['m']):
            celdas = {}
            for c in row.findall('m:c', NS):
                col = re.match(r'[A-Z]+', c.get('r')).group()
                v = c.find('m:v', NS)
                if v is None:
                    inl = c.find('m:is', NS)
                    val = ''.join(t.text or '' for t in inl.iter(T)) if inl is not None else ''
                else:
                    val = ss[int(v.text)] if c.get('t') == 's' else (v.text or '')
                if val.strip():
                    celdas[col] = val.strip()
            if celdas:
                filas.append((int(row.get('r')), celdas))
        hojas.append((sh.get('name').strip(), filas))
    return hojas


def solo_digitos(v):
    v = (v or '').strip().replace('‪', '').replace('‬', '')
    if re.fullmatch(r'\d+(\.\d+)?[eE][+-]?\d+|\d+\.0+', v):
        try:
            return str(int(Decimal(v)))
        except InvalidOperation:
            pass
    m = re.search(r'wa\.me/(\d+)', v, re.I)
    if m:
        return m.group(1)
    return re.sub(r'\D', '', v.split('/')[0])


def pais_de(lada, hoja):
    l = sin_acentos((lada or '').lower())
    for patron, pais, cc in PAISES:
        if re.search(sin_acentos(patron), l):
            return pais, cc
    return ('México', '52') if 'MEXICO' in sin_acentos(hoja.upper()) else ('Estados Unidos', '1')


def a_whatsapp(d, cc, es_link):
    """Número internacional (solo dígitos) o None si no es válido."""
    if not d:
        return None
    if es_link and len(d) >= 11:
        if d.startswith('521') and len(d) == 13:
            return '52' + d[3:]
        return d if len(d) <= 15 else None
    if cc == '1':
        if len(d) == 10:
            return '1' + d
        if len(d) == 11 and d.startswith('1'):
            return d
        return None
    if cc == '52':
        if len(d) == 13 and d.startswith('521'):
            return '52' + d[3:]
        if len(d) == 12 and d.startswith('52'):
            return d
        if len(d) == 11 and d.startswith('1'):  # 1 + 10 dígitos (formato viejo de celular)
            return '52' + d[1:]
        return '52' + d if len(d) == 10 else None
    if d.startswith(cc) and 7 <= len(d) - len(cc) <= 11:
        return d
    return cc + d if 7 <= len(d) <= 11 else None


def formato_tel(wa):
    if not wa:
        return ''
    if wa.startswith('1') and len(wa) == 11:
        return f'+1 ({wa[1:4]}) {wa[4:7]}-{wa[7:]}'
    if wa.startswith('52') and len(wa) == 12:
        n = wa[2:]
        return f'+52 {n[:2]} {n[2:6]} {n[6:]}' if n[:2] in ('33', '55', '81') else f'+52 {n[:3]} {n[3:6]} {n[6:]}'
    for _, _, cc in PAISES:
        if cc not in ('1', '52') and wa.startswith(cc):
            n = wa[len(cc):]
            grupos = {10: (3, 3, 4), 9: (3, 3, 3), 8: (4, 4), 7: (3, 4)}.get(len(n), (len(n),))
            partes, i = [], 0
            for g in grupos:
                partes.append(n[i:i + g]); i += g
            return f'+{cc} ' + ' '.join(partes)
    return '+' + wa


def fecha_de(v):
    v = (v or '').strip()
    m = re.match(r'(\d{1,2})/(\d{1,2})/(\d{2,4})', v)
    if m:
        mes, dia, an = int(m.group(1)), int(m.group(2)), int(m.group(3))
        an += 2000 if an < 100 else 0
        try:
            return datetime.date(an, mes, dia).isoformat()
        except ValueError:
            return None
    if re.fullmatch(r'\d{5}(\.\d+)?', v):
        return (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(float(v)))).isoformat()
    return None


def sede_de(v):
    v = re.sub(r'\s+', ' ', (v or '').strip())
    if not v:
        return ''
    k = sin_acentos(v.lower()).strip(' .')
    return SEDE_ALIAS[k] if k in SEDE_ALIAS else titulo(v)


def motivo_de(texto):
    t = sin_acentos(texto.lower())
    for clave, patron in MOTIVOS:
        if re.search(sin_acentos(patron), t):
            return clave
    return 'sin_motivo'


def main(ruta, salida):
    registros = []
    for hoja, filas in leer_xlsx(ruta):
        if not filas:
            continue
        enc = {sin_acentos(v.strip().upper()).rstrip('.'): k for k, v in filas[0][1].items()}
        col = lambda *ns: next((enc[n] for n in ns if n in enc), None)
        c_nom, c_mail, c_lada = col('NOMBRE'), col('EMAIL'), col('LADA')
        c_tel, c_corr = col('TEL'), col('CORREGIDO')
        c_fecha, c_fcont = col('FECHA', 'R'), col('FECHA DE CONTACTO')
        c_ciudad, c_asig, c_cont = col('CIUDAD'), col('ASIGNADO A'), col('CONTACTO')
        c_est, c_notas = col('ESTADO', 'ESTATUS'), col('NOTAS')
        hoja_up = sin_acentos(hoja.upper())
        for fila, c in filas[1:]:
            g = lambda k: c.get(k, '') if k else ''
            email = g(c_mail).strip().lower()
            if not g(c_nom).strip() and not email:
                continue
            nombre = limpiar_nombre(g(c_nom), email)
            lada = g(c_lada)
            pais, cc = pais_de(lada if not re.fullmatch(r'[\d.eE+]+', lada) else '', hoja)
            # Candidatos de teléfono, del más confiable al menos
            cands = []
            for v in c.values():
                if re.search(r'wa\.me/\d', v, re.I):
                    cands.append((solo_digitos(v), True))
            if c_corr:
                cands.append((solo_digitos(g(c_corr)), False))
            cands.append((solo_digitos(g(c_tel)), False))
            if re.fullmatch(r'[\d.eE+]+', lada):  # en algunas hojas el teléfono quedó en LADA
                cands.append((solo_digitos(lada), False))
            wa = next((w for w in (a_whatsapp(d, cc, link) for d, link in cands) if w), None)
            if wa and wa.startswith('52') and len(wa) == 12:
                pais = pais if pais != 'Estados Unidos' else 'México'
            nota_raw = g(c_notas)
            tel_alt = None
            notas = []
            if nota_raw:
                d = re.sub(r'\D', '', nota_raw)
                if re.fullmatch(r'\+?[\d\s()-]{10,18}', nota_raw) and len(d) >= 10:
                    tel_alt = a_whatsapp(d, cc, d.startswith(cc) and len(d) > 10)
                else:
                    notas.append({'t': nota_raw, 'h': titulo(hoja), 'f': fecha_de(g(c_fcont))})
            for k, v in c.items():  # columnas sueltas a la derecha (p. ej. "NO CONTACTAR")
                if k not in filas[0][1] and not re.fullmatch(r'[\d.]+', v) and 'wa.me' not in v.lower():
                    notas.append({'t': v, 'h': titulo(hoja)})
            est_raw = g(c_est).strip().upper()
            estado = ESTADOS.get(est_raw)
            if not estado and est_raw.startswith('YA RENOV'):
                estado = 'renovado'
            if not estado:
                estado = 'contactado' if notas else 'pendiente'
            if not wa and tel_alt:
                wa, tel_alt = tel_alt, None
            if wa and estado == 'pendiente' and est_raw in ('#INVALIDO',):
                estado = 'invalido'
            if tel_alt == wa:
                tel_alt = None
            texto_notas = ' '.join(n['t'] for n in notas)
            registros.append({
                'hoja': titulo(hoja), 'fila': fila, 'nombre': nombre, 'email': email,
                'wa': wa, 'telAlt': tel_alt, 'pais': pais,
                'sede': titulo(hoja) if hoja_up in SEDES_HOJA else sede_de(g(c_ciudad)),
                'fecha': fecha_de(g(c_fecha)),
                'asignado': EQUIPO.get(g(c_asig).upper(), g(c_asig)),
                'contacto': EQUIPO.get(g(c_cont).upper(), g(c_cont)),
                'estado': estado, 'notas': notas,
                'noContactar': bool(NO_CONTACTAR.search(texto_notas)) or 'NO CONTACTAR' in texto_notas.upper(),
                'ciudadHoja': hoja_up in SEDES_HOJA,
            })

    # Fusionar duplicados (misma persona en varias hojas)
    grupos = {}
    for r in registros:
        clave = r['email'] or (r['wa'] and 'tel:' + r['wa']) or f"fila:{r['hoja']}:{r['fila']}"
        grupos.setdefault(clave, []).append(r)

    contactos = []
    for clave, rs in grupos.items():
        # La hoja por ciudad es la versión trabajada más reciente: va primero
        rs.sort(key=lambda r: (not r['ciudadHoja'], -RANGO.index(r['estado'])))
        p = rs[0]
        primero = lambda k: next((r[k] for r in rs if r[k]), None)
        wa = primero('wa')
        alts = [x for r in rs for x in (r['wa'], r['telAlt']) if x and x != wa]
        estado = max((r['estado'] for r in rs), key=RANGO.index)
        notas = [n for r in rs for n in r['notas']]
        c = {
            'id': hashlib.sha1(clave.encode()).hexdigest()[:12],
            'nombre': p['nombre'] or primero('nombre') or p['email'],
            'email': p['email'],
            'wa': wa,
            'tel': formato_tel(wa),
            'pais': next((r['pais'] for r in rs if r['wa'] == wa), p['pais']),
            'sede': primero('sede') or '',
            'hojas': sorted({r['hoja'] for r in rs}),
            'fecha': min((r['fecha'] for r in rs if r['fecha']), default=None),
            'asignado': primero('asignado') or '',
            'contacto': primero('contacto') or '',
            'estado': estado,
            'notas': notas,
        }
        if alts:
            c['telAlt'] = formato_tel(alts[0])
        if estado == 'no_interesado':
            c['motivo'] = motivo_de(' '.join(n['t'] for n in notas))
        if any(r['noContactar'] for r in rs):
            c['noContactar'] = True
        c['region'] = 'EUA' if c['pais'] == 'Estados Unidos' else 'México' if c['pais'] == 'México' else 'LATAM y otros'
        for n in c['notas']:
            if not n.get('f'):
                n.pop('f', None)
        contactos.append(c)

    contactos.sort(key=lambda c: c['nombre'].lower())
    ids = [c['id'] for c in contactos]
    assert len(ids) == len(set(ids)), 'ids repetidos'
    base = {'generado': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
            'fuente': ruta.split('/')[-1].strip(), 'contactos': contactos}
    with open(salida, 'w', encoding='utf-8') as f:
        json.dump(base, f, ensure_ascii=False, separators=(',', ':'))

    from collections import Counter
    print(f'{len(registros)} filas → {len(contactos)} contactos ({len(registros) - len(contactos)} duplicados fusionados)')
    print('estados:', dict(Counter(c['estado'] for c in contactos).most_common()))
    print('regiones:', dict(Counter(c['region'] for c in contactos).most_common()))
    print('sin WhatsApp válido:', sum(1 for c in contactos if not c['wa']))
    print('no contactar:', sum(1 for c in contactos if c.get('noContactar')))
    print('motivos:', dict(Counter(c.get('motivo') for c in contactos if c.get('motivo')).most_common()))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

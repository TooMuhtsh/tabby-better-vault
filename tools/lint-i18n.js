/**
 * Vérifie que les tables de `src/i18n/` collent aux chaînes sources du code.
 *
 * POURQUOI CET OUTIL EXISTE. Le mécanisme de traduction de Tabby utilise la
 * chaîne source anglaise comme clé, et son `CustomMissingTranslationHandler`
 * rend la clé elle-même quand aucune traduction ne correspond. Une clé désuète
 * ne provoque donc NI erreur de compilation, NI avertissement à l'exécution :
 * la phrase retombe simplement en anglais, et personne ne s'en aperçoit avant
 * qu'un utilisateur ne le signale. Corriger une virgule dans le gabarit suffit.
 *
 * Ce script rend cette dérive visible. Il fait les deux sens :
 *   — une chaîne du code qu'aucune table ne traduit (traduction manquante) ;
 *   — une clé de table qui n'existe plus dans le code (clé morte).
 *
 * LIMITE ASSUMÉE : l'extraction est lexicale. Elle voit les littéraux passés au
 * pipe `| translate` et à `i18n.t()`, plus les tables de `messages.ts` ; elle ne
 * peut pas suivre une chaîne rangée dans une constante puis traduite ailleurs.
 * Ces cas sont déclarés dans `EXTRA_SOURCES`, et le script vérifie qu'ils
 * existent encore — une exception oubliée est elle-même signalée.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

/** Littéral simple quote, échappements compris. */
const STR = "'((?:[^'\\\\]|\\\\.)*)'"

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8')
const unescape = s => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\')

/**
 * Chaînes que l'extraction lexicale ne peut pas voir, avec l'endroit qui les
 * porte. Le script vérifie que ce nom y est toujours défini : une constante
 * renommée ou supprimée sans mise à jour de cette liste est signalée.
 */
const EXTRA_SOURCES = [
    { file: 'vaultBridge.service.ts', constant: 'UNLOCK_MESSAGE' },
]

function collectSources () {
    const sources = new Map() // chaîne -> origine, pour un rapport lisible

    const add = (value, where) => {
        const key = unescape(value)
        if (!sources.has(key)) {
            sources.set(key, where)
        }
    }

    // Gabarit : '...' | translate
    const pug = 'components/settingsTab.component.pug'
    for (const m of read(pug).matchAll(new RegExp(STR + '\\s*\\|\\s*translate', 'g'))) {
        add(m[1], pug)
    }

    // Appels i18n.t('...') et listes `source: '...'`
    for (const f of ['components/settingsTab.component.ts', 'vaultBridge.service.ts']) {
        const content = read(f)
        for (const m of content.matchAll(new RegExp('i18n\\.t\\(\\s*' + STR, 'g'))) {
            add(m[1], f)
        }
        for (const m of content.matchAll(new RegExp('source:\\s*' + STR, 'g'))) {
            add(m[1], f)
        }
    }

    // REASON / OPERATION / GUARD : entrées d'objet au premier niveau
    for (const m of read('messages.ts').matchAll(new RegExp('^\\s{4}\\w+:\\s*' + STR + ',?$', 'gm'))) {
        add(m[1], 'messages.ts')
    }

    // keychainName() : les trois noms de coffre
    const osk = read('osKeychain.ts')
    const fn = osk.slice(osk.indexOf('export function keychainName'))
    for (const m of fn.slice(0, fn.indexOf('\n}')).matchAll(new RegExp('return ' + STR, 'g'))) {
        add(m[1], 'osKeychain.ts')
    }

    // Constantes non atteignables par extraction
    for (const extra of EXTRA_SOURCES) {
        const content = read(extra.file)
        const m = new RegExp('const ' + extra.constant + ' = ' + STR).exec(content)
        if (!m) {
            console.error(`EXTRA_SOURCES obsolète : ${extra.constant} n'est plus défini dans ${extra.file}`)
            process.exitCode = 1
            continue
        }
        add(m[1], `${extra.file} (${extra.constant})`)
    }

    return sources
}

function loadTable (lang) {
    // Les tables sont du TypeScript sans type ni import : un `export default`
    // suivi d'un littéral d'objet. On l'isole et on l'évalue plutôt que de
    // tirer TypeScript dans un script de vérification.
    const raw = fs.readFileSync(path.join(SRC, 'i18n', `${lang}.ts`), 'utf8')
    const start = raw.indexOf('export default')
    const body = raw.slice(raw.indexOf('{', start))
    // eslint-disable-next-line no-eval
    return eval('(' + body.replace(/\}\s*$/, '}') + ')')
}

/** Noms des paramètres `{x}` d'une chaîne. */
function placeholders (text) {
    return new Set([...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1]))
}

/**
 * Défauts qu'ICU MessageFormat ne révélerait qu'à l'affichage.
 *
 * L'apostrophe droite est le caractère d'échappement de MessageFormat : collée à
 * une accolade, elle fait disparaître le paramètre au lieu de le substituer.
 * `jusqu'{date}` est muet, `jusqu'au {date}` est correct — un piège que le
 * français déclenche naturellement et qu'aucun test de compilation n'attrape.
 */
function icuProblems (text) {
    const problems = []
    const s = String(text)

    if (/'[{}]/.test(s)) {
        problems.push('apostrophe droite collée à une accolade (ICU l\'interprète comme une échappement)')
    }

    let depth = 0
    for (const c of s) {
        if (c === '{') depth++
        if (c === '}') depth--
        if (depth < 0) break
    }
    if (depth !== 0) {
        problems.push('accolades déséquilibrées')
    }

    return problems
}

const LANGS = ['fr-FR', 'es-ES', 'de-DE']

const sources = collectSources()
let failures = 0

console.log(`${sources.size} chaînes sources relevées dans src/.`)

for (const lang of LANGS) {
    const table = loadTable(lang)
    const keys = new Set(Object.keys(table))

    const missing = [...sources.keys()].filter(s => !keys.has(s))
    const dead = [...keys].filter(k => !sources.has(k))
    const empty = [...keys].filter(k => !String(table[k]).trim())

    // Un paramètre perdu en traduction ne se voit qu'à l'écran, sur le cas rare
    // qui déclenche la phrase : une date qui n'apparaît jamais, un motif
    // d'erreur amputé. Comparer les jeux de `{x}` le rend visible tout de suite.
    const paramMismatch = []
    const icu = []
    for (const k of keys) {
        const expected = placeholders(k)
        const actual = placeholders(table[k])
        const lost = [...expected].filter(p => !actual.has(p))
        const invented = [...actual].filter(p => !expected.has(p))
        if (lost.length || invented.length) {
            paramMismatch.push({ key: k, lost, invented })
        }
        for (const problem of icuProblems(table[k])) {
            icu.push({ key: k, problem })
        }
    }

    if (!missing.length && !dead.length && !empty.length && !paramMismatch.length && !icu.length) {
        console.log(`  ${lang} : ${keys.size} clés, complet.`)
        continue
    }

    failures++
    console.log(`  ${lang} : ${keys.size} clés.`)
    for (const s of missing) {
        console.log(`    MANQUE    (${sources.get(s)}) ${JSON.stringify(s)}`)
    }
    for (const k of dead) {
        console.log(`    CLÉ MORTE ${JSON.stringify(k)}`)
    }
    for (const k of empty) {
        console.log(`    VIDE      ${JSON.stringify(k)}`)
    }
    for (const p of paramMismatch) {
        const details = [
            p.lost.length ? `perdu(s) : ${p.lost.join(', ')}` : '',
            p.invented.length ? `inventé(s) : ${p.invented.join(', ')}` : '',
        ].filter(Boolean).join(' — ')
        console.log(`    PARAMÈTRE ${details}\n              ${JSON.stringify(p.key)}`)
    }
    for (const p of icu) {
        console.log(`    ICU       ${p.problem}\n              ${JSON.stringify(p.key)}`)
    }
}

// Les chaînes sources traversent le même compilateur que les traductions.
const sourceIcu = [...sources.keys()].flatMap(s => icuProblems(s).map(problem => ({ s, problem })))
for (const { s, problem } of sourceIcu) {
    console.log(`  source : ICU — ${problem}\n           ${JSON.stringify(s)}`)
    failures++
}

if (failures) {
    console.error(`\n${failures} table(s) à corriger.`)
    process.exitCode = 1
} else if (!process.exitCode) {
    console.log('\nToutes les tables collent aux chaînes sources.')
}

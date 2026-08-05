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

/**
 * Bundle compilé de `tabby-core`, seule source de vérité disponible hors
 * exécution pour deux choses que ce script vérifie : la liste des locales que
 * Tabby connaît, et les `msgid` qu'il traduit déjà.
 *
 * Absent si les dépendances ne sont pas installées — les contrôles qui en
 * dépendent sont alors annoncés comme non faits, jamais silencieusement
 * réputés bons.
 */
const TABBY_CORE = path.join(ROOT, 'node_modules', 'tabby-core', 'dist', 'index.js')

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

/** Contenu du bundle de `tabby-core`, ou `null` s'il n'est pas installé. */
function tabbyBundle () {
    try {
        return fs.readFileSync(TABBY_CORE, 'utf8')
    } catch {
        return null
    }
}

/**
 * Isole un littéral d'objet ou de tableau à partir de sa première accolade, en
 * équilibrant les délimiteurs et en ignorant ceux qui vivent dans une chaîne.
 */
function sliceLiteral (text, from, open, close) {
    let depth = 0
    let quote = null
    for (let i = from; i < text.length; i++) {
        const c = text[i]
        if (quote) {
            if (c === '\\') {
                i++
            } else if (c === quote) {
                quote = null
            }
            continue
        }
        if (c === '"' || c === "'") {
            quote = c
        } else if (c === open) {
            depth++
        } else if (c === close) {
            depth--
            if (!depth) {
                return text.slice(from, i + 1)
            }
        }
    }
    return null
}

/**
 * Locales que Tabby connaît, d'après `LocaleService.allLanguages`.
 *
 * Enregistrer une table sous un code absent de cette liste est sans effet : la
 * locale ne sera jamais activée, donc la table jamais consultée. C'est le mode
 * de défaillance le plus silencieux du chantier i18n — aucune erreur, aucune
 * traduction, et un `lint:i18n` au vert puisqu'il ne regardait que les fichiers.
 */
function tabbyLocales (bundle) {
    const marker = 'LocaleService.allLanguages = '
    const at = bundle.indexOf(marker)
    if (at === -1) {
        return null
    }
    const literal = sliceLiteral(bundle, bundle.indexOf('[', at), '[', ']')
    if (!literal) {
        return null
    }
    return new Set([...literal.matchAll(/code:\s*'([\w-]+)'/g)].map(m => m[1]))
}

/**
 * `msgid` que Tabby traduit déjà pour cette locale.
 *
 * Les `.po` sont bundlés dans `tabby-core` sous forme de `module.exports = {…}`
 * JSON, ce qui les rend lisibles sans exécuter quoi que ce soit.
 */
function tabbyMessages (bundle, lang) {
    const at = bundle.indexOf(`"../locale/${lang}.po":`)
    if (at === -1) {
        return null
    }
    const exportsAt = bundle.indexOf('module.exports = ', at)
    const literal = sliceLiteral(bundle, bundle.indexOf('{', exportsAt), '{', '}')
    if (!literal) {
        return null
    }
    try {
        const po = JSON.parse(literal)
        const entries = po.translations?.[''] ?? {}
        const messages = new Map()
        for (const [msgid, entry] of Object.entries(entries)) {
            if (msgid) {
                messages.set(msgid, entry?.msgstr?.[0] ?? '')
            }
        }
        return messages
    } catch {
        return null
    }
}

/**
 * Locales réellement ENREGISTRÉES par `src/i18n/index.ts`, et non la liste de
 * fichiers présents.
 *
 * Ce script tenait sa liste en dur et n'ouvrait jamais `index.ts` : une table
 * écrite, traduite, complète, mais absente de `TABLES` passait au vert sans
 * jamais s'afficher. Un fichier n'est une traduction que s'il est enregistré.
 */
function registeredTables () {
    const raw = read('i18n/index.ts')
    const at = raw.indexOf('const TABLES')
    const literal = at === -1 ? null : sliceLiteral(raw, raw.indexOf('{', at), '{', '}')
    if (!literal) {
        console.error("src/i18n/index.ts : impossible de relire la table TABLES — le contrôle d'enregistrement est HORS SERVICE.")
        process.exitCode = 1
        return []
    }

    const registered = [...literal.matchAll(/'([\w-]+)'\s*:\s*(\w+)/g)].map(m => ({ lang: m[1], binding: m[2] }))
    const files = fs.readdirSync(path.join(SRC, 'i18n'))
        .filter(f => f.endsWith('.ts') && f !== 'index.ts')
        .map(f => f.replace(/\.ts$/, ''))

    for (const lang of files) {
        if (!registered.some(r => r.lang === lang)) {
            console.error(`  ${lang} : table présente mais JAMAIS ENREGISTRÉE dans TABLES — elle ne s'affichera pas.`)
            process.exitCode = 1
        }
    }
    for (const { lang, binding } of registered) {
        if (!files.includes(lang)) {
            console.error(`  ${lang} : enregistrée dans TABLES sans fichier src/i18n/${lang}.ts.`)
            process.exitCode = 1
        }
        if (!new RegExp(`import\\s+${binding}\\s+from\\s+'\\./${lang}'`).test(raw)) {
            console.error(`  ${lang} : enregistrée sous le nom « ${binding} », qui n'importe pas ./${lang}.`)
            process.exitCode = 1
        }
    }

    return registered.map(r => r.lang)
}

const bundle = tabbyBundle()
const locales = bundle ? tabbyLocales(bundle) : null

const LANGS = registeredTables()

const sources = collectSources()
let failures = 0

console.log(`${sources.size} chaînes sources relevées dans src/.`)
console.log(`${LANGS.length} table(s) enregistrée(s) dans src/i18n/index.ts : ${LANGS.join(', ') || '(aucune)'}.`)

if (!bundle) {
    console.log('tabby-core absent de node_modules : codes de locale et collisions de msgid NON VÉRIFIÉS.')
} else if (!locales) {
    console.log('LocaleService.allLanguages introuvable dans le bundle : codes de locale NON VÉRIFIÉS.')
} else {
    for (const lang of LANGS) {
        if (!locales.has(lang)) {
            console.error(`  ${lang} : code inconnu de Tabby — la locale ne sera jamais activée, la table jamais lue.`)
            failures++
        }
    }
}

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

    // COLLISIONS AVEC LES MSGID DE TABBY. La clé est la chaîne source anglaise
    // et l'enregistrement se fait avec `shouldMerge = true` : toute clé qui
    // coïncide avec un msgid de Tabby remplace SA traduction pour l'application
    // entière, pas seulement dans notre panneau (#V24). Une clé courte et
    // générique — « Cancel », « Open », « File » — y expose naturellement.
    //
    // Valeur identique : sans effet visible, signalé pour mémoire. Valeur
    // différente : ce plugin change le vocabulaire de Tabby, et c'est un défaut.
    const clashes = []
    const overrides = []
    const tabby = bundle ? tabbyMessages(bundle, lang) : null
    if (tabby) {
        for (const k of keys) {
            if (!tabby.has(k)) {
                continue
            }
            const theirs = tabby.get(k)
            if (theirs && theirs !== String(table[k])) {
                overrides.push({ key: k, ours: table[k], theirs })
            } else {
                clashes.push(k)
            }
        }
    }

    if (!missing.length && !dead.length && !empty.length && !paramMismatch.length && !icu.length && !overrides.length) {
        const shared = clashes.length ? ` — ${clashes.length} clé(s) partagée(s) avec Tabby, valeurs identiques : ${clashes.map(k => JSON.stringify(k)).join(', ')}` : ''
        if (!tabby && bundle) {
            console.log(`  ${lang} : ${keys.size} clés, complet (msgid de Tabby introuvables, collisions NON VÉRIFIÉES).`)
            continue
        }
        console.log(`  ${lang} : ${keys.size} clés, complet${shared}.`)
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
    for (const o of overrides) {
        console.log(`    ÉCRASE TABBY  ${JSON.stringify(o.key)}\n                  Tabby dit ${JSON.stringify(o.theirs)}, nous ${JSON.stringify(o.ours)} — notre valeur gagne pour TOUTE l'application (#V24).`)
    }
    for (const k of clashes) {
        console.log(`    partagée avec Tabby, même valeur : ${JSON.stringify(k)}`)
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

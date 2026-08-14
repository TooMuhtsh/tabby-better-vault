const path = require('path')

/**
 * Exporté en fonction et non en objet : `npm run build:prod` passe
 * `--mode production` sur la ligne de commande, que webpack-cli fusionne
 * PAR-DESSUS la config — un objet ne peut donc pas savoir dans quel mode il
 * est construit. C'est ce qui faisait partir dist/index.js.map (490 Ko de
 * sources TS commentées) dans le tarball npm de la 1.0.1 : `mode` était bien
 * production, mais `devtool` gardait sa valeur de développement
 * (.AIRules/ROADMAP.html#hygiene-paquet, même correctif que le projet frère).
 */
module.exports = (env, argv) => {
  const isProduction = (argv?.mode ?? process.env.NODE_ENV) === 'production'

  return {
    target: 'node',
    entry: 'src/index.ts',
    // Jamais dans le paquet publié : `files: ["dist"]` embarque le dossier
    // entier. Conservée en développement, où elle est le but.
    devtool: isProduction ? false : 'source-map',
    context: __dirname,
    mode: isProduction ? 'production' : 'development',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'index.js',
      // Chemins de modules inlinés en commentaires : utile en debug local,
      // du poids mort à côté d'un bundle minifié.
      pathinfo: !isProduction,
      // Pas de `clean: true` ici : les .d.ts que `typings` désigne sont
      // écrits dans dist/ par TypeScript, hors des assets webpack — un
      // nettoyage les emporterait. La map résiduelle d'un build de dev est
      // retirée par scripts/strip-source-maps.js (build:prod).
      libraryTarget: 'umd',
      devtoolModuleFilenameTemplate: 'webpack-tabby-better-vault:///[resource-path]',
    },
    resolve: {
      modules: ['.', 'src', 'node_modules'].map(x => path.join(__dirname, x)),
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'tsconfig.json'),
          },
        },
        // Les composants Angular d'un plugin tiers ne peuvent pas utiliser
        // `templateUrl` : le template doit être inliné via `require('./x.pug')`
        // (.AIRules/AI-CONTEXT.html, piège hérité #3).
        { test: /\.pug$/, use: ['apply-loader', 'pug-loader'] },
        // Le SCSS est importé en side-effect et injecté en CSS globale : d'où la
        // nécessité de porter les styles par une classe racine plutôt que par
        // `:host`, qui n'a aucun effet ici (piège hérité #14).
        { test: /\.scss$/, use: ['style-loader', 'css-loader', 'sass-loader'] },
      ],
    },
    externals: [
      'fs',
      'os',
      'path',
      // Doit rester external : Tabby pré-cache ce module et sert sa propre
      // instance, seule reliée au conteneur de toasts affiché à l'écran
      // (.AIRules/AI-CONTEXT.html, piège #V8).
      'ngx-toastr',
      // Résolu à l'exécution par l'environnement Electron de Tabby, jamais bundlé.
      // Que ce require aboutisse depuis un plugin tiers est précisément l'objet du
      // spike (.AIRules/AI-CONTEXT.html, piège #V7) — ne pas retirer sans l'avoir vérifié.
      '@electron/remote',
      /^rxjs/,
      /^@angular/,
      /^@ng-bootstrap/,
      /^tabby-/,
    ],
  }
}

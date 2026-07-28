const path = require('path')

module.exports = {
  target: 'node',
  entry: 'src/index.ts',
  devtool: 'source-map',
  context: __dirname,
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    pathinfo: true,
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

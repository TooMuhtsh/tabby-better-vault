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
    ],
  },
  externals: [
    'fs',
    'os',
    'path',
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

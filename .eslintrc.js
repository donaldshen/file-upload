module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2020: true,
    node: true,
  },
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  plugins: ['prettier'],
  parserOptions: {
    ecmaVersion: 11,
  },
  rules: {},
}

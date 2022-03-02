module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:node/recommended",
    'plugin:@wordpress/eslint-plugin/recommended-with-formatting'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    // Temp override to slowly change everything
    'sort-imports': ['warn', {
      allowSeparatedGroups: true,
      ignoreCase: true,
      memberSyntaxSortOrder: ['all', 'single', 'multiple', 'none'],
    }],
    'sort-keys': ['warn', 'asc', { natural: true }],
    'sort-vars': ['warn', { ignoreCase: true }],
  },
};

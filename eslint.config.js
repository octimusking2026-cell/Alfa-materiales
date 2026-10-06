import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['node_modules/**/*', 'dist/**/*']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];

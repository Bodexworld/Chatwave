import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*']
  },
  {
    plugins: {
      '@firebase/security-rules': firebaseRulesPlugin,
    },
    files: ['**/*.rules'],
    rules: {
         ...firebaseRulesPlugin.configs.recommended.rules
    }
  }
];

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // Ignora os diretórios de build
  {
    ignores: ["lib/**/*"],
  },

  // Configuração GERAL recomendada pelo ESLint
  js.configs.recommended,

  // --- CONFIGURAÇÃO ESPECÍFICA PARA ARQUIVOS TYPESCRIPT (*.ts) ---
  ...tseslint.configs.recommendedTypeChecked, // Usa as regras que precisam de checagem de tipo
  {
    files: ["src/**/*.ts"], // Aplica apenas aos arquivos dentro da pasta 'src'
    languageOptions: {
      parserOptions: {
        project: ["tsconfig.json", "tsconfig.dev.json"], // Aponta para os projetos TS
      },
    },
    rules: {
      // Suas regras customizadas para TypeScript
      "quotes": ["error", "double"],
      "indent": ["error", 2],
      "import/no-unresolved": "off",

      // Correção para o erro de 'no-unused-expressions'
      "no-unused-expressions": "off",
      "@typescript-eslint/no-unused-expressions": ["error", {
        "allowShortCircuit": true,
        "allowTernary": true,
        "allowTaggedTemplates": true,
      }],
    },
  },

  // --- CONFIGURAÇÃO ESPECÍFICA PARA ARQUIVOS JAVASCRIPT (*.js) ---
  {
    files: ["eslint.config.js"], // Aplica apenas ao próprio arquivo de config
    languageOptions: {
      globals: {
        ...globals.node, // Usa as variáveis globais do Node.js
      },
    },
  }
);
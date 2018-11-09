// The code are modified from vue-cli 3, https://github.com/vuejs/vue-cli/blob/dev/packages/%40vue/cli-plugin-typescript/lib/tslint.js

const fs = require('fs');
const path = require('path');
const tslint = require('tslint');
const ts = require('typescript');
const globby = require('globby');
const vueCompiler = require('vue-template-compiler');

function resolveFromRoot(filePath) {
  return path.join(process.cwd(), filePath);
}

const isVueFile = file => /\.vue(\.ts)?$/.test(file);

const lint = (args = {}) => {
  const configPath = resolveFromRoot(args.config || 'tslint.json');
  const projectPath = resolveFromRoot(args.project || 'tsconfig.json');

  const defaultOptions = {
    fix: false,
    formatter: 'codeFrame',
  };
  const { fix } = args;
  const options = { ...defaultOptions, fix };

  // hack to make tslint --fix work for *.vue files:
  // we save the non-script parts to a cache right before
  // linting the file, and patch fs.writeFileSync to combine the fixed script
  // back with the non-script parts.
  // this works because (luckily) tslint lints synchronously.
  const vueFileCache = new Map();
  const { writeFileSync } = fs;

  const patchWriteFile = () => {
    fs.writeFileSync = (file, content, option) => {
      if (isVueFile(file)) {
        const parts = vueFileCache.get(path.normalize(file));
        if (parts) {
          const { before, after } = parts;
          // eslint-disable-next-line no-param-reassign
          content = `${before}\n${content.trim()}\n${after}`;
        }
      }
      return writeFileSync(file, content, option);
    };
  };

  const restoreWriteFile = () => {
    fs.writeFileSync = writeFileSync;
  };

  // eslint-disable-next-line consistent-return
  const parseTSFromVueFile = (file) => {
    const content = fs.readFileSync(file, 'utf-8');
    const { script } = vueCompiler.parseComponent(content, { pad: 'line' });
    if (script && /^tsx?$/.test(script.lang)) {
      vueFileCache.set(file, {
        before: content.slice(0, script.start),
        after: content.slice(script.end),
      });
      return script.content;
    }
  };

  const program = tslint.Linter.createProgram(projectPath);

  // patch getSourceFile for *.vue files
  // so that it returns the <script> block only
  // eslint-disable-next-line no-shadow
  const patchProgram = (program) => {
    const { getSourceFile } = program;
    // eslint-disable-next-line no-param-reassign
    program.getSourceFile = (file, languageVersion, onError) => {
      if (isVueFile(file)) {
        const script = parseTSFromVueFile(file) || '';
        return ts.createSourceFile(file, script, languageVersion, true);
      }
      return getSourceFile.call(this, file, languageVersion, onError);
    };
  };

  patchProgram(program);

  const linter = new tslint.Linter(options, program);

  // patch linter.updateProgram to ensure every program has correct getSourceFile
  const { updateProgram } = linter;
  // eslint-disable-next-line no-shadow
  linter.updateProgram = (...args) => {
    updateProgram.call(this, ...args);
    patchProgram(this.program);
  };

  const config = tslint.Configuration.findConfiguration(configPath).results;
  // create a patched config that disables the blank lines rule,
  // so that we get correct line numbers in error reports for *.vue files.
  const vueConfig = Object.assign(config);
  // eslint-disable-next-line no-multi-assign
  const rules = (vueConfig.rules = new Map(vueConfig.rules));
  const rule = rules.get('no-consecutive-blank-lines');
  rules.set(
    'no-consecutive-blank-lines',
    Object.assign({}, rule, {
      ruleSeverity: 'off',
    }),
  );

  const lintFile = (file) => {
    const filePath = resolveFromRoot(file);
    const isVue = isVueFile(file);
    patchWriteFile();
    linter.lint(
      // append .ts so that tslint apply TS rules
      filePath,
      '',
      // use Vue config to ignore blank lines
      isVue ? vueConfig : config,
    );
    restoreWriteFile();
  };

  const filesPattern = ['./**/*.ts', './**/*.vue', './**/*.tsx'];

  return globby(filesPattern, { cwd: projectPath }).then((files) => {
    files.forEach(lintFile);
    const result = linter.getResult();
    if (result.output.trim()) {
      process.stdout.write(result.output);
    } else if (result.fixes.length) {
      // some formatters do not report fixes.
      const f = new tslint.Formatters.ProseFormatter();
      process.stdout.write(f.format(result.failures, result.fixes));
    } else if (!result.failures.length) {
      console.log('No lint errors found.\n');
    }

    if (result.failures.length && !args.force) {
      process.exitCode = 1;
    }
  });
};

module.exports = { lint };

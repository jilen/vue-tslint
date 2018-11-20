# vue-tslint

A cli tool that lint your Vue SFC files with TSLint

## install

```bash
npm i -D vue-tslint
```

## usage

Please use with TypeScript version > 3.0.0

```txt
Usage: vue-tslint [options]

Options:
  -c, --config [config]    TSLint configuration file. Default: project root
  -p, --project [project]  Folder that contain your tsconfig.json file. Default: project root
  --fix                    Fixes linting errors for select rules (this may overwrite linted files).
  -e, --exclude <exclude>  An array of glob patterns to exclude matches
  -g, --gitignore          Respect ignore patterns in .gitignore files that apply to the globbed files
  -v, --version            output the version number
  -h, --help               output usage information
```

### example

```bash
vue-tslint -p vue-project -c tslint.json --fix
```

## lisence

MIT

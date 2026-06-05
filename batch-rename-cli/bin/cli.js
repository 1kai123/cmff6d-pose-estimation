#!/usr/bin/env node

const { parseArgs } = require('util');
const path = require('path');
const {
  renameByPattern,
  renameByList,
  previewRename,
  undoRename,
  getHistory,
} = require('../src/index.js');

const USAGE = `
batch-rename CLI — powerful batch file renaming tool

Usage:
  batch-rename <command> [options]

Commands:
  pattern    Rename files using a pattern (search & replace or regex)
  list       Rename files using a CSV/JSON mapping list
  undo       Undo the last batch rename operation
  history    Show rename history for a directory
  help       Show this help message

Examples:
  # Preview renaming: replace "IMG_" with "photo_" in all .jpg files
  batch-rename pattern --search "IMG_" --replace "photo_" --ext .jpg

  # Preview with regex
  batch-rename pattern --search "^(\\d+)_" --replace "img-$1" --regex --ext .jpg

  # Actually rename (add --confirm)
  batch-rename pattern --search "IMG_" --replace "photo_" --ext .jpg --confirm

  # Undo last operation
  batch-rename undo

  # Show history
  batch-rename history
`.trim();

const PATTERN_USAGE = `
batch-rename pattern — rename files by search/replace pattern

Usage:
  batch-rename pattern [options]

Options:
  --search <string>     Search string or regex pattern (required)
  --replace <string>    Replacement string (required)
  --regex               Treat search string as regex (default: false)
  --ext <string>        Filter by file extension, e.g. .jpg .txt (optional)
  --dir <path>          Target directory (default: current directory)
  --recursive           Recursively process subdirectories (default: false)
  --confirm             Actually rename (default: preview only)
  --dry-run             Alias for --confirm=false (default behavior)
`.trim();

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === 'help') {
    console.log(USAGE);
    return;
  }

  const command = args[0];

  if (command === 'pattern') {
    await runPattern(args.slice(1));
  } else if (command === 'undo') {
    await runUndo(args.slice(1));
  } else if (command === 'history') {
    await runHistory(args.slice(1));
  } else {
    console.error(`Unknown command: ${command}`);
    console.log(USAGE);
    process.exit(1);
  }
};

async function runPattern(rawArgs) {
  const {
    values,
    tokens,
    error: parseErr,
  } = parseArgs({
    options: {
      search: { type: 'string', short: 's' },
      replace: { type: 'string', short: 'r' },
      regex: { type: 'boolean', short: 'x', default: false },
      ext: { type: 'string', short: 'e' },
      dir: { type: 'string', short: 'd', default: '.' },
      recursive: { type: 'boolean', short: 'R', default: false },
      confirm: { type: 'boolean', short: 'c', default: false },
    },
    allowPositionals: true,
    tokens: true,
    argv: rawArgs,
  });

  if (parseErr) {
    console.error(parseErr.message);
    console.log(PATTERN_USAGE);
    process.exit(1);
  }

  if (!values.search || values.replace === undefined) {
    console.error('Error: --search and --replace are required.');
    console.log(PATTERN_USAGE);
    process.exit(1);
  }

  const opts = {
    search: values.search,
    replace: values.replace,
    useRegex: values.regex,
    extension: values.ext,
    directory: path.resolve(values.dir),
    recursive: values.recursive,
    dryRun: !values.confirm,
  };

  const results = await previewRename(opts);

  if (results.length === 0) {
    console.log('No files matched the pattern.');
    return;
  }

  console.log(`\nFound ${results.length} file(s) to rename:\n`);
  for (const { oldName, newName } of results) {
    const arrow = opts.dryRun ? '  →  ' : '  →  ';
    console.log(`  ${oldName}${arrow}${newName}`);
  }

  if (opts.dryRun) {
    console.log('\n(Dry run — no files were renamed)');
    console.log('Run with --confirm to apply the changes.');
  } else {
    console.log('\nRenamed successfully.');
  }

  if (!opts.dryRun) {
    await renameByPattern(opts);
  }
}

async function runUndo(rawArgs) {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', short: 'd', default: '.' },
      steps: { type: 'number', short: 'n', default: 1 },
    },
    argv: rawArgs,
  });

  await undoRename({
    directory: path.resolve(values.dir),
    steps: values.steps,
  });
}

async function runHistory(rawArgs) {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', short: 'd', default: '.' },
    },
    argv: rawArgs,
  });

  const history = await getHistory(path.resolve(values.dir));
  if (!history || history.length === 0) {
    console.log('No rename history found.');
    return;
  }

  console.log(`Rename history for: ${path.resolve(values.dir)}\n`);
  for (const entry of history) {
    console.log(`  ${entry.oldName}  →  ${entry.newName}  (${entry.timestamp})`);
  }
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});

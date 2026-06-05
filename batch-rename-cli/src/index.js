'use strict';

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const rename = promisify(fs.rename);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

const HISTORY_FILE = '.batch-rename-history.json';

function loadHistory(directory) {
  const histPath = path.join(directory, HISTORY_FILE);
  if (!fs.existsSync(histPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(histPath, 'utf-8'));
  } catch {
    return [];
  }
}

function saveHistory(directory, history) {
  const histPath = path.join(directory, HISTORY_FILE);
  fs.writeFileSync(histPath, JSON.stringify(history, null, 2), 'utf-8');
}

async function collectFiles(directory, extension, recursive) {
  const entries = await readdir(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    let isFile = false;
    try {
      const st = await stat(fullPath);
      isFile = st.isFile();
    } catch {
      continue;
    }

    if (extension && path.extname(entry) !== extension) continue;
    if (entry === HISTORY_FILE) continue;
    if (!isFile) continue;
    if (recursive && (await stat(fullPath)).isDirectory()) {
      const sub = await collectFiles(fullPath, extension, recursive);
      files.push(...sub);
    } else {
      files.push({ absolute: fullPath, name: entry });
    }
  }

  return files;
}

function computeNewName(oldName, search, replace, useRegex) {
  if (useRegex) {
    try {
      const re = new RegExp(search, 'g');
      return oldName.replace(re, replace);
    } catch {
      throw new Error(`Invalid regex pattern: ${search}`);
    }
  } else {
    return oldName.split(search).join(replace);
  }
}

async function previewRename(opts) {
  const { search, replace, useRegex, extension, directory, recursive } = opts;
  const files = await collectFiles(directory, extension, recursive);
  const results = [];

  for (const { absolute, name } of files) {
    const newName = computeNewName(name, search, replace, useRegex);
    if (newName !== name) {
      results.push({ absolute, oldName: name, newName });
    }
  }

  return results;
}

async function renameByPattern(opts) {
  const { search, replace, useRegex, extension, directory, recursive, dryRun } = opts;

  if (dryRun) {
    return await previewRename(opts);
  }

  const files = await collectFiles(directory, extension, recursive);
  const history = loadHistory(directory);
  const batchEntry = {
    timestamp: new Date().toISOString(),
    operation: 'pattern',
    search,
    replace,
    useRegex,
    renames: [],
  };

  for (const { absolute, name } of files) {
    const newName = computeNewName(name, search, replace, useRegex);
    if (newName !== name) {
      const dir = path.dirname(absolute);
      const newPath = path.join(dir, newName);
      try {
        await rename(absolute, newPath);
        batchEntry.renames.push({ oldPath: absolute, newPath, oldName: name, newName });
      } catch (err) {
        console.error(`  Failed to rename "${name}": ${err.message}`);
      }
    }
  }

  if (batchEntry.renames.length > 0) {
    history.push(batchEntry);
    saveHistory(directory, history);
  }

  return batchEntry.renames;
}

async function renameByList(opts) {
  const { list, directory, dryRun } = opts;
  const history = loadHistory(directory);
  const batchEntry = {
    timestamp: new Date().toISOString(),
    operation: 'list',
    renames: [],
  };

  for (const { oldName, newName } of list) {
    const oldPath = path.join(directory, oldName);
    const newPath = path.join(directory, newName);
    if (!fs.existsSync(oldPath)) {
      console.error(`  File not found: "${oldName}"`);
      continue;
    }
    if (!dryRun) {
      try {
        await rename(oldPath, newPath);
        batchEntry.renames.push({ oldPath, newPath, oldName, newName });
      } catch (err) {
        console.error(`  Failed to rename "${oldName}": ${err.message}`);
      }
    } else {
      batchEntry.renames.push({ oldPath, newPath, oldName, newName });
    }
  }

  if (batchEntry.renames.length > 0 && !dryRun) {
    history.push(batchEntry);
    saveHistory(directory, history);
  }

  return batchEntry.renames;
}

async function undoRename(opts) {
  const { directory, steps = 1 } = opts;
  const history = loadHistory(directory);

  if (history.length === 0) {
    console.log('No rename history to undo.');
    return;
  }

  const toUndo = history.splice(-steps);
  saveHistory(directory, history);

  let totalReverted = 0;
  for (const batch of toUndo.reverse()) {
    for (const { newPath, oldPath } of batch.renames.reverse()) {
      try {
        if (fs.existsSync(newPath)) {
          await rename(newPath, oldPath);
          totalReverted++;
        }
      } catch (err) {
        console.error(`  Failed to undo "${newPath}": ${err.message}`);
      }
    }
  }

  console.log(`Undone ${totalReverted} rename(s) across ${toUndo.length} batch(es).`);
}

function getHistory(directory) {
  return loadHistory(directory);
}

module.exports = {
  previewRename,
  renameByPattern,
  renameByList,
  undoRename,
  getHistory,
};

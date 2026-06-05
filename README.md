# batch-rename-cli

A powerful CLI tool for batch renaming files with pattern matching, regex support, recursive directory traversal, and full undo capability.

## Features

- **Pattern-based renaming** — search & replace with plain text or regex
- **Regex support** — full JavaScript regex support (capture groups, etc.)
- **Recursive mode** — process subdirectories
- **File extension filtering** — target specific file types
- **Dry-run preview** — always see what will happen before anything changes
- **Full undo** — revert any batch rename operation
- **History tracking** — persistent rename history per directory

## Installation

### From source

```bash
git clone https://github.com/1kai123/batch-rename-cli.git
cd batch-rename-cli
npm install
npm link   # makes `batch-rename` available globally
```

### From npm (after publishing)

```bash
npm install -g batch-rename-cli
```

## Usage

```bash
batch-rename <command> [options]
```

### Commands

| Command  | Description                              |
|----------|------------------------------------------|
| `pattern`| Rename files by search/replace pattern  |
| `undo`   | Undo the last batch rename operation    |
| `history`| Show rename history for a directory      |
| `help`   | Show help message                        |

### pattern command

```bash
batch-rename pattern [options]
```

**Options:**

| Short | Long           | Description                                      |
|-------|----------------|--------------------------------------------------|
| `-s`  | `--search`     | Search string or regex pattern (required)        |
| `-r`  | `--replace`    | Replacement string (required)                   |
| `-x`  | `--regex`      | Treat search string as regex                     |
| `-e`  | `--ext`        | Filter by file extension (e.g. `.jpg`)          |
| `-d`  | `--dir`        | Target directory (default: current directory)    |
| `-R`  | `--recursive`  | Recursively process subdirectories              |
| `-c`  | `--confirm`    | Actually rename (default: dry-run preview only)  |

## Examples

### Preview renaming (dry-run)

Replace `IMG_` with `photo_` in all `.jpg` files:

```bash
batch-rename pattern --search "IMG_" --replace "photo_" --ext .jpg
```

### Apply the rename

```bash
batch-rename pattern --search "IMG_" --replace "photo_" --ext .jpg --confirm
```

### Regex with capture groups

Rename `photo001.jpg` → `img-001.jpg`:

```bash
batch-rename pattern --search "^photo(\\d+)" --replace "img-$1" --regex --ext .jpg --confirm
```

### Recursive rename across subdirectories

```bash
batch-rename pattern --search "_old" --replace "_new" --recursive --confirm
```

### Undo the last operation

```bash
batch-rename undo
```

Undo the last 2 operations:

```bash
batch-rename undo --steps 2
```

### Show rename history

```bash
batch-rename history
```

## How it works

- **Dry-run by default** — the tool always shows a preview first, so you can verify before anything changes
- **History file** — a `.batch-rename-history.json` is created in each processed directory, tracking every rename operation
- **Undo** — uses the history file to reverse renames in the correct order

## License

MIT

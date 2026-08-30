import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = process.cwd();
const DIRS_TO_PROCESS = ['app', 'components', 'hooks', 'lib', 'public', 'styles'];

function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        walkDir(fullPath, fileList);
      }
    } else if (/\.(tsx|ts|jsx|js|css|json|svg)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

let modifiedCount = 0;
let occurrencesReplaced = 0;

for (const subDir of DIRS_TO_PROCESS) {
  const targetPath = path.join(ROOT_DIR, subDir);
  const files = walkDir(targetPath);

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let hasChanges = false;

    // 1. Hex codes variations
    if (content.includes('#FF6B35') || content.includes('#ff6b35') || content.includes('#FF6b35') || content.includes('#ff6B35')) {
      const regex = /#FF6B35|#ff6b35|#FF6b35|#ff6B35/g;
      const matches = content.match(regex);
      if (matches) {
        occurrencesReplaced += matches.length;
        content = content.replace(regex, '#FF5722');
        hasChanges = true;
      }
    }

    // 2. RGBA with 255, 107, 53
    if (content.includes('255, 107, 53') || content.includes('255,107,53')) {
      const regex = /255,\s*107,\s*53/g;
      const matches = content.match(regex);
      if (matches) {
        occurrencesReplaced += matches.length;
        content = content.replace(regex, '255, 87, 34');
        hasChanges = true;
      }
    }

    if (hasChanges) {
      fs.writeFileSync(file, content, 'utf8');
      modifiedCount++;
      console.log(`[UPDATED] ${path.relative(ROOT_DIR, file)}`);
    }
  }
}

console.log(`\n=== RAPPORT D'HARMONISATION ===`);
console.log(`Fichiers modifiés: ${modifiedCount}`);
console.log(`Occurrences remplacées: ${occurrencesReplaced}`);

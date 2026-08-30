import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = process.cwd();
const DIRS_TO_PROCESS = ['app', 'components'];

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
    } else if (/\.(tsx|ts|jsx|js)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

let modifiedFiles = 0;

for (const subDir of DIRS_TO_PROCESS) {
  const targetPath = path.join(ROOT_DIR, subDir);
  const files = walkDir(targetPath);

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. Replace inline old button colors
    content = content.replace(/className="bg-\[#FF5722\]\s+hover:bg-\[#ff5719\]\s+text-white\s+flex\s+items-center\s+gap-2\s+shadow-lg\s+shadow-\[#FF5722\]\/20"/g, 'variant="primary" className="flex items-center gap-2"');
    content = content.replace(/className="bg-\[#FF5722\]\s+hover:bg-\[#ff5719\]\s+text-white\s+text-xs\s+flex\s+items-center\s+gap-2\s+shadow-lg\s+shadow-\[#FF5722\]\/20"/g, 'variant="primary" size="sm" className="flex items-center gap-2"');
    content = content.replace(/className="bg-\[#FF5722\]\s+hover:bg-\[#ff5719\]\s+text-white\s+text-xs\s+flex\s+items-center\s+gap-1"/g, 'variant="primary" size="sm" className="flex items-center gap-1"');
    content = content.replace(/className="bg-\[#FF5722\]\s+hover:bg-\[#ff5719\]\s+text-white\s+text-xs\s+shadow-lg\s+shadow-\[#FF5722\]\/20"/g, 'variant="primary" size="sm"');
    content = content.replace(/className="bg-\[#FF5722\]\s+hover:bg-\[#ff5719\]\s+text-white\s+shadow-lg\s+shadow-\[#FF5722\]\/20"/g, 'variant="primary"');
    content = content.replace(/className="bg-\[#FF5722\]\s+hover:bg-\[#ff5719\]\s+text-white\s+text-xs"/g, 'variant="primary" size="sm"');
    content = content.replace(/className="bg-\[#FF5722\]\s+text-white\s+flex\s+items-center\s+gap-1\.5"/g, 'variant="primary" size="sm" className="flex items-center gap-1.5"');

    // 2. Active filter pills/tabs
    content = content.replace(/selectedStatus === tab \?\s*'bg-\[#FF5722\] text-white shadow-sm'/g, "selectedStatus === tab ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold'");
    content = content.replace(/filterStatus === 'AMBASSADEUR' \? 'bg-\[#FF5722\] text-white' : 'text-slate-500'/g, "filterStatus === 'AMBASSADEUR' ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold' : 'text-slate-500'");
    content = content.replace(/periodPreset === 'ALL' \? 'bg-\[#FF5722\] text-white' : 'text-slate-500'/g, "periodPreset === 'ALL' ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold' : 'text-slate-500'");
    content = content.replace(/periodPreset === '30D' \? 'bg-\[#FF5722\] text-white' : 'text-slate-500'/g, "periodPreset === '30D' ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold' : 'text-slate-500'");
    content = content.replace(/periodPreset === '7D' \? 'bg-\[#FF5722\] text-white' : 'text-slate-500'/g, "periodPreset === '7D' ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold' : 'text-slate-500'");

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      modifiedFiles++;
      console.log(`[GRADIENT UPGRADE] ${path.relative(ROOT_DIR, file)}`);
    }
  }
}

console.log(`\n=== MISE À NIVEAU DÉGRADÉ SUNSET TERMINÉE ===`);
console.log(`Fichiers mis à jour: ${modifiedFiles}`);

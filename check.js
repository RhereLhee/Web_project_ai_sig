#!/usr/bin/env node
/**
 * 📦 Export Project Structure for AI
 * สร้างไฟล์โครงสร้างโปรเจคที่พร้อมส่งให้ AI วิเคราะห์
 */

const fs = require('fs');
const path = require('path');

// ⚙️ การตั้งค่า
const CONFIG = {
  // โฟลเดอร์/ไฟล์ที่ข้าม
  ignore: new Set([
    'node_modules',
    '.next',
    '.git',
    'dist',
    'build',
    '.cache',
    'coverage',
    '.vercel',
    '.turbo',
    '__pycache__',
    '.pytest_cache',
    '.venv',
    'venv',
    '.DS_Store',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.env.local',
    '.env.production',
  ]),
  
  // นามสกุลไฟล์ที่สำคัญ (จะแสดงเด่นๆ)
  importantExtensions: new Set([
    '.tsx', '.ts', '.jsx', '.js',
    '.css', '.scss',
    '.prisma',
    '.json',
    '.env.example',
  ]),
  
  // ชื่อไฟล์พิเศษ
  specialFiles: new Set([
    'package.json',
    'tsconfig.json',
    'next.config.js',
    'next.config.mjs',
    'tailwind.config.js',
    'tailwind.config.ts',
    '.env.example',
    'prisma/schema.prisma',
  ]),
};

/**
 * ตรวจสอบว่าควรข้ามไฟล์/โฟลเดอร์นี้หรือไม่
 */
function shouldIgnore(name, filePath) {
  if (CONFIG.ignore.has(name)) return true;
  
  // ข้ามไฟล์ที่ขึ้นต้นด้วย . (ยกเว้นบางไฟล์)
  if (name.startsWith('.')) {
    const allowed = ['.env.example', '.gitignore', '.eslintrc', '.eslintrc.json', '.eslintrc.js'];
    if (!allowed.includes(name)) return true;
  }
  
  return false;
}

/**
 * นับจำนวนไฟล์และโฟลเดอร์
 */
function countItems(dirPath, stats = { files: 0, dirs: 0, byExt: {} }) {
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      
      if (shouldIgnore(item, itemPath)) continue;
      
      try {
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          stats.dirs++;
          countItems(itemPath, stats);
        } else {
          stats.files++;
          const ext = path.extname(item);
          stats.byExt[ext] = (stats.byExt[ext] || 0) + 1;
        }
      } catch (err) {
        // ข้ามไฟล์ที่เข้าถึงไม่ได้
      }
    }
  } catch (err) {
    // ข้ามโฟลเดอร์ที่เข้าถึงไม่ได้
  }
  
  return stats;
}

/**
 * สร้าง tree structure
 */
function buildTree(dirPath, prefix = '', isLast = true, lines = []) {
  try {
    const name = path.basename(dirPath);
    const connector = isLast ? '└── ' : '├── ';
    
    const stat = fs.statSync(dirPath);
    
    if (stat.isDirectory()) {
      lines.push(`${prefix}${connector}📁 ${name}/`);
      
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      
      try {
        const items = fs.readdirSync(dirPath)
          .filter(item => !shouldIgnore(item, path.join(dirPath, item)))
          .sort((a, b) => {
            // โฟลเดอร์ก่อน แล้วเรียงตาม alphabet
            const aPath = path.join(dirPath, a);
            const bPath = path.join(dirPath, b);
            const aIsDir = fs.statSync(aPath).isDirectory();
            const bIsDir = fs.statSync(bPath).isDirectory();
            
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b);
          });
        
        items.forEach((item, index) => {
          const itemPath = path.join(dirPath, item);
          const isLastItem = index === items.length - 1;
          buildTree(itemPath, newPrefix, isLastItem, lines);
        });
      } catch (err) {
        lines.push(`${newPrefix}[Permission Denied]`);
      }
    } else {
      // ไฟล์
      const ext = path.extname(name);
      let icon = '📄';
      
      if (['.tsx', '.jsx'].includes(ext)) icon = '⚛️';
      else if (['.ts', '.js'].includes(ext)) icon = '📘';
      else if (['.css', '.scss'].includes(ext)) icon = '🎨';
      else if (ext === '.json') icon = '📋';
      else if (ext === '.prisma') icon = '🗄️';
      else if (ext === '.md') icon = '📝';
      
      const marker = CONFIG.specialFiles.has(name) || 
                     CONFIG.specialFiles.has(path.relative(path.dirname(dirPath), dirPath) + '/' + name)
                     ? ' ⭐' : '';
      
      lines.push(`${prefix}${connector}${icon} ${name}${marker}`);
    }
  } catch (err) {
    lines.push(`${prefix}${connector}[Error: ${err.message}]`);
  }
  
  return lines;
}

/**
 * สร้างเอาต์พุตสำหรับ AI
 */
function generateOutput(projectPath) {
  const projectName = path.basename(projectPath);
  const stats = countItems(projectPath);
  
  let output = '';
  
  // Header
  output += '━'.repeat(80) + '\n';
  output += `📦 PROJECT STRUCTURE: ${projectName}\n`;
  output += '━'.repeat(80) + '\n\n';
  
  // สถิติ
  output += '📊 STATISTICS:\n';
  output += `   • Total Files: ${stats.files}\n`;
  output += `   • Total Folders: ${stats.dirs}\n`;
  output += '\n';
  
  // แยกตามประเภทไฟล์
  output += '📁 FILES BY TYPE:\n';
  const sortedExts = Object.entries(stats.byExt)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  sortedExts.forEach(([ext, count]) => {
    const extName = ext || '(no extension)';
    output += `   • ${extName}: ${count} files\n`;
  });
  output += '\n';
  
  output += '━'.repeat(80) + '\n';
  output += '🌲 PROJECT TREE:\n';
  output += '━'.repeat(80) + '\n\n';
  
  // Tree structure
  output += `📁 ${projectName}/\n`;
  
  try {
    const items = fs.readdirSync(projectPath)
      .filter(item => !shouldIgnore(item, path.join(projectPath, item)))
      .sort((a, b) => {
        const aPath = path.join(projectPath, a);
        const bPath = path.join(projectPath, b);
        const aIsDir = fs.statSync(aPath).isDirectory();
        const bIsDir = fs.statSync(bPath).isDirectory();
        
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
      });
    
    items.forEach((item, index) => {
      const itemPath = path.join(projectPath, item);
      const isLast = index === items.length - 1;
      const lines = buildTree(itemPath, '', isLast, []);
      output += lines.join('\n') + '\n';
    });
  } catch (err) {
    output += `[Error reading directory: ${err.message}]\n`;
  }
  
  output += '\n' + '━'.repeat(80) + '\n';
  output += '⭐ = Important configuration files\n';
  output += '━'.repeat(80) + '\n';
  
  return output;
}

/**
 * ฟังก์ชันหลัก
 */
function main() {
  const args = process.argv.slice(2);
  const projectPath = args[0] ? path.resolve(args[0]) : process.cwd();
  
  if (!fs.existsSync(projectPath)) {
    console.error(`❌ Error: Directory not found: ${projectPath}`);
    process.exit(1);
  }
  
  if (!fs.statSync(projectPath).isDirectory()) {
    console.error(`❌ Error: Path is not a directory: ${projectPath}`);
    process.exit(1);
  }
  
  console.log('🔍 Scanning project structure...\n');
  
  const output = generateOutput(projectPath);
  
  // บันทึกไฟล์
  const outputFileName = 'PROJECT_STRUCTURE.txt';
  const outputPath = path.join(projectPath, outputFileName);
  
  fs.writeFileSync(outputPath, output, 'utf8');
  
  console.log(output);
  console.log(`\n✅ Saved to: ${outputPath}`);
  console.log('\n💡 TIP: Copy this file content and send it to AI for analysis!');
}

// Run
if (require.main === module) {
  main();
}

module.exports = { generateOutput, buildTree, countItems };
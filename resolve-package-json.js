const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const status = execSync('git status --porcelain').toString();
const conflictedFiles = status.split('\n')
  .filter(line => line.startsWith('UU '))
  .map(line => line.substring(3));

for (const file of conflictedFiles) {
  if (file.endsWith('package.json')) {
    console.log(`Resolving ${file}...`);
    // Get the hotfix version of the file
    const hotfixContent = execSync(`git show hotfix/1.0.1:${file}`).toString();
    const pkg = JSON.parse(hotfixContent);
    
    // Replace @wenyan/ with @andrey-kokoev/wenyan-
    if (pkg.name && pkg.name.startsWith('@wenyan/')) {
      pkg.name = pkg.name.replace('@wenyan/', '@andrey-kokoev/wenyan-');
    }
    
    if (pkg.dependencies) {
      for (const dep of Object.keys(pkg.dependencies)) {
        if (dep.startsWith('@wenyan/')) {
          const val = pkg.dependencies[dep];
          delete pkg.dependencies[dep];
          pkg.dependencies[dep.replace('@wenyan/', '@andrey-kokoev/wenyan-')] = val;
        }
      }
    }
    
    if (pkg.devDependencies) {
      for (const dep of Object.keys(pkg.devDependencies)) {
        if (dep.startsWith('@wenyan/')) {
          const val = pkg.devDependencies[dep];
          delete pkg.devDependencies[dep];
          pkg.devDependencies[dep.replace('@wenyan/', '@andrey-kokoev/wenyan-')] = val;
        }
      }
    }
    
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    execSync(`git add ${file}`);
  }
}

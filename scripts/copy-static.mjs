import {cp,mkdir} from 'node:fs/promises';
for (const path of ['docs','demo','favicon.svg','THIRD_PARTY.md']) await cp(path,`dist/${path}`,{recursive:true});
await mkdir('dist/licenses',{recursive:true});
for (const [name,path] of Object.entries({
  'react.txt':'node_modules/react/LICENSE', 'react-dom.txt':'node_modules/react-dom/LICENSE',
  'three.txt':'node_modules/three/LICENSE', 'echarts.txt':'node_modules/echarts/LICENSE',
  'echarts-notice.txt':'node_modules/echarts/NOTICE', 'zrender.txt':'node_modules/zrender/LICENSE',
  'vite.txt':'node_modules/vite/LICENSE.md'
})) await cp(path,`dist/licenses/${name}`);

import {cp} from 'node:fs/promises';
for (const path of ['docs','demo','favicon.svg']) await cp(path,`dist/${path}`,{recursive:true});

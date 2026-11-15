// Prueba de reglas: npm i -D @firebase/rules-unit-testing@3 firebase@10 && npx firebase emulators:exec --only firestore --project demo-t "node tests/rules.test.mjs"
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {readFileSync} from 'fs';import {doc,setDoc,updateDoc} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-t',firestore:{rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8'),host:'127.0.0.1',port:8085}});
await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();
  await setDoc(doc(d,'users/tec'),{role:'tecnico',active:true});await setDoc(doc(d,'users/sup'),{role:'supervisor',active:true});
  await setDoc(doc(d,'users/sup2'),{role:'supervisor',active:true});
  await setDoc(doc(d,'backlogs/b1'),{status:'EN_PROCESO'});await setDoc(doc(d,'backlogs/b2'),{status:'PENDIENTE_VALIDACION',closeUid:'sup'});});
const db=u=>env.authenticatedContext(u,{email:u+'@coansa.com'}).firestore();
const ok=[],t=async(n,p)=>{try{await p;ok.push('✔ '+n)}catch(e){ok.push('✘ '+n+' '+e.message);process.exitCode=1}};
await t('técnico cierra con su propio closeUid',assertSucceeds(updateDoc(doc(db('tec'),'backlogs/b1'),{status:'PENDIENTE_VALIDACION',closeUid:'tec'})));
await t('técnico NO pone closeUid de otro',assertFails(updateDoc(doc(db('tec'),'backlogs/b2'),{closeUid:'sup2'})));
await t('supervisor NO valida su propio cierre',assertFails(updateDoc(doc(db('sup'),'backlogs/b2'),{status:'COMPLETADO'})));
await t('otro supervisor sí valida',assertSucceeds(updateDoc(doc(db('sup2'),'backlogs/b2'),{status:'COMPLETADO'})));
await t('técnico NO completa',assertFails(updateDoc(doc(db('tec'),'backlogs/b1'),{status:'COMPLETADO'})));
await t('técnico NO se hace admin',assertFails(updateDoc(doc(db('tec'),'users/tec'),{role:'admin'})));
await t('técnico edita backlog abierto sin tocar closeUid',assertSucceeds(updateDoc(doc(db('tec'),'backlogs/b1'),{description:'x'})));
console.log(ok.join('\n'));await env.cleanup();

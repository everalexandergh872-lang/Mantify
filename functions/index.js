/* Cloud Function: el planner asigna una contraseña nueva a un usuario que la olvidó.
   Desde el navegador Firebase solo deja cambiar la clave propia; aquí, con el SDK de administrador,
   se cambia la de otro usuario después de comprobar EN EL SERVIDOR que quien llama es admin activo. */
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();

// mismo formato que hashPw() en app.js: pbkdf2$iteraciones$sal$hash
const HASH_RE = /^pbkdf2\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/;

exports.resetPassword = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const users = admin.firestore().collection('users');
  const caller = (await users.doc(req.auth.uid).get()).data();
  if (!caller || caller.role !== 'admin' || caller.active === false)
    throw new HttpsError('permission-denied', 'Solo un planner activo puede cambiar contraseñas.');

  const {uid, password, pass} = req.data || {};
  if (typeof uid !== 'string' || !/^[\w-]{1,128}$/.test(uid)) throw new HttpsError('invalid-argument', 'Usuario no válido.');
  if (typeof password !== 'string' || password.length < 6 || password.length > 128)
    throw new HttpsError('invalid-argument', 'La contraseña debe tener entre 6 y 128 caracteres.');
  if (typeof pass !== 'string' || !HASH_RE.test(pass) || pass.length > 300) throw new HttpsError('invalid-argument', 'Hash no válido.');

  const target = users.doc(uid);
  if (!(await target.get()).exists) throw new HttpsError('failed-precondition', 'El usuario no existe.');

  // primero Firebase Auth (la clave real) y luego el hash; si el segundo paso falla, el planner reintenta y ambos quedan iguales
  await admin.auth().updateUser(uid, {password});
  await target.update({pass, passChangedAt: Date.now(), passChangedBy: caller.name || req.auth.uid});
  return {ok: true};
});

/* El planner elimina a una persona: borra su cuenta de Firebase Auth y su perfil.
   Sus backlogs, cierres y firmas en las OT se conservan (guardan el nombre, no dependen de la cuenta). */
exports.deleteUser = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Inicia sesión.');
  const users = admin.firestore().collection('users');
  const caller = (await users.doc(req.auth.uid).get()).data();
  if (!caller || caller.role !== 'admin' || caller.active === false)
    throw new HttpsError('permission-denied', 'Solo un planner activo puede eliminar personal.');
  const {uid} = req.data || {};
  if (typeof uid !== 'string' || !/^[\w-]{1,128}$/.test(uid)) throw new HttpsError('invalid-argument', 'Usuario no válido.');
  if (uid === req.auth.uid) throw new HttpsError('failed-precondition', 'No puedes eliminarte a ti mismo.');
  try { await admin.auth().deleteUser(uid); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
  await users.doc(uid).delete();
  return {ok: true};
});

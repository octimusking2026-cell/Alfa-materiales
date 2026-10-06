/**
 * scripts/asignar-claims-admin.mjs
 * Script para asignar Custom Claim { admin: true } a los correos de administración en Firebase Auth.
 * 
 * Uso:
 *   node scripts/asignar-claims-admin.mjs
 *   node scripts/asignar-claims-admin.mjs otro-correo@gmail.com
 *   node scripts/asignar-claims-admin.mjs ./serviceAccountKey.json correo@dominio.com
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

const ADMIN_EMAILS_DEFAULT = [
  "octimusking2026@gmail.com",
  "jhonnytumach@gmail.com"
];

function cargarCredenciales() {
  const args = process.argv.slice(2);
  let serviceAccount = null;

  // 1. Argumento de línea de comandos que sea un archivo .json existente
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.endsWith(".json") && fs.existsSync(arg)) {
      try {
        const contenido = fs.readFileSync(path.resolve(arg), "utf8");
        serviceAccount = JSON.parse(contenido);
        console.log(`[AUTH-ADMIN] Credenciales cargadas desde archivo: ${arg}`);
        // Remover el archivo JSON de la lista de argumentos para que no se confunda con un email
        args.splice(i, 1);
        break;
      } catch (err) {
        console.error(`[AUTH-ADMIN] Error leyendo archivo de credenciales ${arg}:`, err.message);
      }
    }
  }

  // 2. Variables de entorno
  if (!serviceAccount) {
    const rawEnv = process.env.JSON_DE_CUENTA_DE_SERVICIO_DE_FIREBASE || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawEnv) {
      try {
        serviceAccount = typeof rawEnv === "string" ? JSON.parse(rawEnv) : rawEnv;
        console.log(`[AUTH-ADMIN] Credenciales cargadas desde variable de entorno.`);
      } catch (err) {
        console.error("[AUTH-ADMIN] Error parseando variable de entorno de cuenta de servicio:", err.message);
      }
    }
  }

  // 3. Normalizar saltos de línea de la private_key si están escapados
  if (serviceAccount?.private_key && typeof serviceAccount.private_key === "string" && serviceAccount.private_key.includes("\\n")) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  return { serviceAccount, emailsRestantes: args };
}

async function main() {
  console.log("=================================================================");
  console.log("   Alfa Materiales — Asignación de Custom Claims { admin: true }");
  console.log("=================================================================\n");

  const { serviceAccount, emailsRestantes } = cargarCredenciales();

  if (!serviceAccount) {
    console.error("❌ No se encontraron credenciales de Cuenta de Servicio de Firebase Admin.\n");
    console.error("Podés suministrarlas de dos maneras:");
    console.error("  1. Configurar la variable de entorno:");
    console.error("     export JSON_DE_CUENTA_DE_SERVICIO_DE_FIREBASE='{\"project_id\":...}'");
    console.error("  2. Pasar la ruta del archivo JSON descargado desde la consola de Firebase:");
    console.error("     node scripts/asignar-claims-admin.mjs ./mi-service-account.json\n");
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }

  const auth = getAuth();

  // Filtrar emails válidos (pasar argumentos CLI o usar los predeterminados)
  const emailsObjetivo = emailsRestantes.filter(arg => arg.includes("@")).length > 0
    ? emailsRestantes.filter(arg => arg.includes("@"))
    : ADMIN_EMAILS_DEFAULT;

  console.log(`📋 Correos a procesar (${emailsObjetivo.length}):`);
  emailsObjetivo.forEach(email => console.log(`   • ${email}`));
  console.log("");

  let asignadosExitosos = 0;
  let errores = 0;

  for (const email of emailsObjetivo) {
    const emailNormalizado = email.trim().toLowerCase();
    try {
      console.log(`🔍 Buscando usuario: ${emailNormalizado}...`);
      const user = await auth.getUserByEmail(emailNormalizado);

      const claimsActuales = user.customClaims || {};
      const nuevosClaims = {
        ...claimsActuales,
        admin: true
      };

      await auth.setCustomUserClaims(user.uid, nuevosClaims);

      // Verificación consultando nuevamente
      const userActualizado = await auth.getUser(user.uid);
      console.log(`✅ Custom Claim { admin: true } asignado con éxito:`);
      console.log(`   UID: ${userActualizado.uid}`);
      console.log(`   Email: ${userActualizado.email}`);
      console.log(`   Claims actuales:`, JSON.stringify(userActualizado.customClaims));
      console.log("");
      asignadosExitosos++;
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        console.warn(`⚠️  El correo ${emailNormalizado} NO existe todavía en Firebase Authentication.`);
        console.warn(`   El usuario debe registrarse o iniciar sesión primero para poder asignarle el rol.\n`);
      } else {
        console.error(`❌ Error al procesar ${emailNormalizado}:`, err.message || err);
        console.log("");
      }
      errores++;
    }
  }

  console.log("-----------------------------------------------------------------");
  console.log(`Resumen: ${asignadosExitosos} usuario(s) configurado(s), ${errores} aviso(s)/error(es).`);
  console.log("Recuerda: Los administradores deberán cerrar y volver a iniciar sesión");
  console.log("para que su token JWT refresque el claim { admin: true } en el cliente.");
  console.log("=================================================================\n");
}

main().catch(err => {
  console.error("Error fatal ejecutando script:", err);
  process.exit(1);
});

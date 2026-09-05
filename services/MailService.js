/**
 * RIMBERIO - Servicio de correo mediante Brevo API.
 *
 * Variables necesarias en Render:
 *
 * BREVO_API_KEY
 * BREVO_SENDER_EMAIL
 * BREVO_SENDER_NAME
 * FRONTEND_URL
 *
 * IMPORTANTE:
 *
 * - No usa SMTP.
 * - No usa Nodemailer.
 * - No utiliza puertos 465/587.
 * - Todo se envía mediante HTTPS.
 */


const BREVO_API_BASE =
  "https://api.brevo.com/v3"


const ROLE_LABELS = {
  owner:
    "Propietario",

  manager:
    "Responsable",

  developer:
    "Desarrollador",

  member:
    "Miembro",

  viewer:
    "Solo lectura"
}


/* ==========================================================
   UTILIDADES
   ========================================================== */

const escaparHtml =
  (
    valor =
      ""
  ) =>
    String(
      valor
    )
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      )


const normalizarCorreo =
  (
    email
  ) =>
    String(
      email ||
      ""
    )
      .trim()
      .toLowerCase()


const correoValido =
  (
    email
  ) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(
        normalizarCorreo(
          email
        )
      )


const textoSeguroError =
  (
    valor
  ) =>
    String(
      valor ||
      ""
    )
      .replace(
        /[\r\n\t]+/g,
        " "
      )
      .trim()
      .slice(
        0,
        300
      )


/* ==========================================================
   MAIL SERVICE
   ========================================================== */

class MailService {

  /* ========================================================
     CONFIGURACION
     ======================================================== */

  obtenerConfiguracion() {

    const apiKey =
      String(
        process.env
          .BREVO_API_KEY ||
        ""
      ).trim()


    const senderEmail =
      normalizarCorreo(
        process.env
          .BREVO_SENDER_EMAIL
      )


    const senderName =
      String(
        process.env
          .BREVO_SENDER_NAME ||
        "RIMBERIO"
      ).trim() ||
      "RIMBERIO"


    const frontendRaw =
      String(
        process.env
          .FRONTEND_URL ||

        process.env
          .CLIENT_URL ||

        ""
      ).trim()


    /* ======================================================
       VALIDACIONES
       ====================================================== */

    if (
      !apiKey
    ) {

      throw new Error(
        "Falta configurar BREVO_API_KEY"
      )
    }


    if (
      !senderEmail
    ) {

      throw new Error(
        "Falta configurar BREVO_SENDER_EMAIL"
      )
    }


    if (
      !correoValido(
        senderEmail
      )
    ) {

      throw new Error(
        "BREVO_SENDER_EMAIL no es un correo válido"
      )
    }


    if (
      !frontendRaw
    ) {

      throw new Error(
        "Falta configurar FRONTEND_URL"
      )
    }


    /*
     * CLIENT_URL puede tener más
     * de una URL separada por comas.
     *
     * Para los enlaces enviados
     * por correo utilizamos únicamente
     * la primera.
     */
    const frontendUrl =
      frontendRaw
        .split(
          ","
        )[0]
        .trim()
        .replace(
          /\/+$/,
          ""
        )


    try {

      new URL(
        frontendUrl
      )

    } catch {

      throw new Error(
        "FRONTEND_URL no es una URL válida"
      )
    }


    return {
      apiKey,
      senderEmail,
      senderName,
      frontendUrl
    }
  }


  /* ========================================================
     PETICIONES A BREVO
     ======================================================== */

  async solicitarBrevo(
    path,
    {
      method =
        "GET",

      body
    } = {}
  ) {

    const config =
      this
        .obtenerConfiguracion()


    const headers = {
      accept:
        "application/json",

      "api-key":
        config.apiKey
    }


    const opciones = {
      method,
      headers
    }


    if (
      body !==
      undefined
    ) {

      headers[
        "content-type"
      ] =
        "application/json"


      opciones.body =
        JSON.stringify(
          body
        )
    }


    let response


    /* ======================================================
       CONECTAR
       ====================================================== */

    try {

      response =
        await fetch(
          `${BREVO_API_BASE}${path}`,
          opciones
        )

    } catch (
      error
    ) {

      /*
       * Nunca mostramos ni registramos
       * BREVO_API_KEY.
       */
      console.error(
        "No se pudo conectar con Brevo API:",
        error?.message ||
        error
      )


      throw new Error(
        "No se pudo conectar con el servicio de correo"
      )
    }


    /* ======================================================
       LEER RESPUESTA
       ====================================================== */

    let data =
      null


    try {

      const contentType =
        String(
          response
            .headers
            .get(
              "content-type"
            ) ||
          ""
        )
          .toLowerCase()


      if (
        contentType.includes(
          "application/json"
        )
      ) {

        data =
          await response
            .json()

      } else {

        const texto =
          await response
            .text()


        data =
          texto
            ? {
                message:
                  texto
              }
            : null
      }

    } catch {

      data =
        null
    }


    /* ======================================================
       ERROR BREVO
       ====================================================== */

    if (
      !response.ok
    ) {

      const detalle =
        textoSeguroError(
          data?.message ||
          data?.error ||
          ""
        )


      console.error(
        "Brevo API rechazó la solicitud:",
        {
          status:
            response.status,

          detalle:
            detalle ||
            "Sin detalle"
        }
      )


      /*
       * API Key incorrecta
       * o no autorizada.
       */
      if (
        response.status ===
        401
      ) {

        throw new Error(
          "Brevo rechazó la API Key"
        )
      }


      /*
       * Normalmente ocurre si:
       *
       * - remitente no verificado
       * - correo incorrecto
       * - campos inválidos
       */
      if (
        response.status ===
        400
      ) {

        throw new Error(
          detalle ||
          "Brevo rechazó los datos del correo"
        )
      }


      throw new Error(
        detalle ||
        `Brevo no pudo procesar el correo (${response.status})`
      )
    }


    return data
  }


  /* ========================================================
     ENVIO GENERICO
     ======================================================== */

  async enviarCorreo({
    email,
    nombre =
      "",
    subject,
    html
  }) {

    const config =
      this
        .obtenerConfiguracion()


    const correo =
      normalizarCorreo(
        email
      )


    const asunto =
      String(
        subject ||
        ""
      ).trim()


    const htmlFinal =
      String(
        html ||
        ""
      ).trim()


    /* ======================================================
       VALIDACIONES
       ====================================================== */

    if (
      !correoValido(
        correo
      )
    ) {

      throw new Error(
        "El correo destinatario no es válido"
      )
    }


    if (
      !asunto
    ) {

      throw new Error(
        "El asunto del correo es obligatorio"
      )
    }


    if (
      !htmlFinal
    ) {

      throw new Error(
        "El contenido del correo es obligatorio"
      )
    }


    const destinatario = {
      email:
        correo
    }


    const nombreDestinatario =
      String(
        nombre ||
        ""
      ).trim()


    if (
      nombreDestinatario
    ) {

      destinatario.name =
        nombreDestinatario
    }


    /* ======================================================
       ENVIAR
       ====================================================== */

    const resultado =
      await this
        .solicitarBrevo(
          "/smtp/email",
          {
            method:
              "POST",

            body: {

              sender: {
                name:
                  config.senderName,

                email:
                  config.senderEmail
              },


              to: [
                destinatario
              ],


              subject:
                asunto,


              htmlContent:
                htmlFinal
            }
          }
        )


    /* ======================================================
       COMPROBAR RESULTADO
       ====================================================== */

    if (
      !resultado
        ?.messageId
    ) {

      throw new Error(
        "Brevo aceptó la petición pero no devolvió un identificador de correo"
      )
    }


    return {
      enviado:
        true,

      messageId:
        resultado.messageId,

      email:
        correo
    }
  }


  /* ========================================================
     URL INVITACION
     ======================================================== */

  crearUrlInvitacion(
    token
  ) {

    const {
      frontendUrl
    } =
      this
        .obtenerConfiguracion()


    const tokenFinal =
      String(
        token ||
        ""
      ).trim()


    if (
      !tokenFinal
    ) {

      throw new Error(
        "El token de invitación es obligatorio"
      )
    }


    const url =
      new URL(
        "/invitaciones/aceptar",
        frontendUrl
      )


    url.searchParams
      .set(
        "token",
        tokenFinal
      )


    return url
      .toString()
  }


  /* ========================================================
     URL RECUPERACION
     ======================================================== */

  crearUrlRestablecerPassword() {

    const {
      frontendUrl
    } =
      this
        .obtenerConfiguracion()


    return new URL(
      "/restablecer-password",
      frontendUrl
    )
      .toString()
  }


  /* ========================================================
     ENVIAR INVITACION
     ======================================================== */

  async enviarInvitacion({
    email,
    token,
    proyecto,
    invitador,
    role,
    expiresAt
  }) {

    const correo =
      normalizarCorreo(
        email
      )


    if (
      !correoValido(
        correo
      )
    ) {

      throw new Error(
        "El correo de invitación no es válido"
      )
    }


    const url =
      this
        .crearUrlInvitacion(
          token
        )


    const nombreProyecto =
      proyecto?.nombre ||
      "Proyecto RIMBERIO"


    const nombreInvitador =
      invitador?.full_name ||
      invitador?.email ||
      "Un administrador"


    const nombreRol =
      ROLE_LABELS[
        role
      ] ||
      role ||
      "Miembro"


    const fechaExpiracion =
      expiresAt
        ? new Date(
            expiresAt
          )
            .toLocaleDateString(
              "es-PE",
              {
                day:
                  "2-digit",

                month:
                  "long",

                year:
                  "numeric"
              }
            )
        : "7 días"


    const subject =
      `Invitación a ${nombreProyecto} | RIMBERIO`


    const html = `
<!DOCTYPE html>

<html lang="es">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    Invitación RIMBERIO
  </title>

</head>


<body
  style="
    margin:0;
    padding:0;
    background:#f6f2ee;
    font-family:
      Arial,
      Helvetica,
      sans-serif;
    color:#2e261f;
  "
>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    style="
      width:100%;
      background:#f6f2ee;
      padding:32px 16px;
    "
  >

    <tr>

      <td
        align="center"
      >

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          style="
            width:100%;
            max-width:600px;
            background:#ffffff;
            border:
              1px solid #eadfd5;
            border-radius:16px;
            overflow:hidden;
          "
        >

          <tr>

            <td
              style="
                padding:
                  24px 28px;

                border-bottom:
                  1px solid #eadfd5;
              "
            >

              <div
                style="
                  font-size:20px;
                  font-weight:700;
                  letter-spacing:
                    0.04em;
                  color:#c1541f;
                "
              >
                RIMBERIO
              </div>


              <div
                style="
                  margin-top:4px;
                  font-size:13px;
                  color:#8a796a;
                "
              >
                Gestión colaborativa
                para restaurantes
              </div>

            </td>

          </tr>


          <tr>

            <td
              style="
                padding:
                  32px 28px;
              "
            >

              <h1
                style="
                  margin:
                    0 0 14px;

                  font-size:23px;
                  line-height:1.3;
                  color:#2e261f;
                "
              >

                Has recibido
                una invitación

              </h1>


              <p
                style="
                  margin:
                    0 0 24px;

                  color:#6d5f53;
                  font-size:15px;
                  line-height:1.7;
                "
              >

                ${escaparHtml(
                  nombreInvitador
                )}

                te ha invitado
                a colaborar en
                un proyecto de
                RIMBERIO.

              </p>


              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                style="
                  width:100%;
                  background:#faf7f4;
                  border:
                    1px solid #eadfd5;
                  border-radius:12px;
                  margin-bottom:26px;
                "
              >

                <tr>

                  <td
                    style="
                      padding:
                        16px 18px 8px;

                      font-size:12px;
                      color:#8a796a;
                    "
                  >
                    PROYECTO
                  </td>

                </tr>


                <tr>

                  <td
                    style="
                      padding:
                        0 18px 16px;

                      font-size:17px;
                      font-weight:700;
                      color:#2e261f;
                    "
                  >

                    ${escaparHtml(
                      nombreProyecto
                    )}

                  </td>

                </tr>


                <tr>

                  <td
                    style="
                      border-top:
                        1px solid #eadfd5;

                      padding:
                        14px 18px;
                    "
                  >

                    <span
                      style="
                        display:block;
                        font-size:12px;
                        color:#8a796a;
                        margin-bottom:4px;
                      "
                    >
                      ROL ASIGNADO
                    </span>


                    <strong
                      style="
                        font-size:14px;
                        color:#2e261f;
                      "
                    >

                      ${escaparHtml(
                        nombreRol
                      )}

                    </strong>

                  </td>

                </tr>

              </table>


              <div
                style="
                  text-align:center;
                  margin:
                    28px 0;
                "
              >

                <a
                  href="${escaparHtml(
                    url
                  )}"
                  style="
                    display:inline-block;
                    background:#c1541f;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:14px;
                    font-weight:700;
                    padding:
                      13px 24px;
                    border-radius:9px;
                  "
                >

                  Aceptar invitación

                </a>

              </div>


              <p
                style="
                  margin:
                    22px 0 5px;

                  color:#8a796a;
                  font-size:12px;
                  line-height:1.6;
                "
              >

                Esta invitación
                vence el

                ${escaparHtml(
                  fechaExpiracion
                )}.

              </p>


              <p
                style="
                  margin:0;
                  color:#8a796a;
                  font-size:12px;
                  line-height:1.6;
                "
              >

                Debes iniciar sesión
                con el mismo correo
                al que se envió
                esta invitación.

              </p>

            </td>

          </tr>


          <tr>

            <td
              style="
                padding:
                  18px 28px;

                background:#faf7f4;
                border-top:
                  1px solid #eadfd5;

                color:#8a796a;
                font-size:11px;
                line-height:1.6;
              "
            >

              Si no esperabas
              recibir esta invitación,
              puedes ignorar
              este mensaje.

            </td>

          </tr>

        </table>

      </td>

    </tr>

  </table>

</body>

</html>
    `.trim()


    /* ======================================================
       ENVIAR CON BREVO
       ====================================================== */

    const resultado =
      await this
        .enviarCorreo({
          email:
            correo,

          subject,

          html
        })


    return {
      ...resultado,

      url
    }
  }


  /* ========================================================
     ENVIAR CODIGO DE RECUPERACION
     ======================================================== */

  async enviarCodigoRecuperacion({
    email,
    nombre,
    codigo,
    venceEnMinutos =
      15
  }) {

    const correo =
      normalizarCorreo(
        email
      )


    const codigoFinal =
      String(
        codigo ||
        ""
      ).trim()


    const minutos =
      Number(
        venceEnMinutos
      )


    const nombreUsuario =
      String(
        nombre ||
        "Usuario"
      ).trim() ||
      "Usuario"


    /* ======================================================
       VALIDACIONES
       ====================================================== */

    if (
      !correoValido(
        correo
      )
    ) {

      throw new Error(
        "El correo de recuperación no es válido"
      )
    }


    /*
     * Muy importante:
     *
     * codigo se mantiene como String
     * para conservar códigos como:
     *
     * 012345
     */
    if (
      !/^\d{6}$/
        .test(
          codigoFinal
        )
    ) {

      throw new Error(
        "El código de recuperación debe tener exactamente 6 números"
      )
    }


    if (
      !Number.isFinite(
        minutos
      ) ||

      minutos <=
        0
    ) {

      throw new Error(
        "El tiempo de expiración del código no es válido"
      )
    }


    const url =
      this
        .crearUrlRestablecerPassword()


    const subject =
      "Código de recuperación | RIMBERIO"


    const html = `
<!DOCTYPE html>

<html lang="es">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    Recuperación de contraseña | RIMBERIO
  </title>

</head>


<body
  style="
    margin:0;
    padding:0;
    background:#f6f2ee;
    font-family:
      Arial,
      Helvetica,
      sans-serif;
    color:#2e261f;
  "
>

  <table
    role="presentation"
    width="100%"
    cellspacing="0"
    cellpadding="0"
    style="
      width:100%;
      background:#f6f2ee;
      padding:
        32px 16px;
    "
  >

    <tr>

      <td
        align="center"
      >

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          style="
            width:100%;
            max-width:600px;
            background:#ffffff;
            border:
              1px solid #eadfd5;
            border-radius:16px;
            overflow:hidden;
          "
        >

          <tr>

            <td
              style="
                padding:
                  24px 28px;

                border-bottom:
                  1px solid #eadfd5;
              "
            >

              <div
                style="
                  font-size:20px;
                  font-weight:700;
                  letter-spacing:
                    0.04em;
                  color:#c1541f;
                "
              >
                RIMBERIO
              </div>


              <div
                style="
                  margin-top:4px;
                  font-size:13px;
                  color:#8a796a;
                "
              >

                Recuperación segura
                de contraseña

              </div>

            </td>

          </tr>


          <tr>

            <td
              style="
                padding:
                  32px 28px;
              "
            >

              <h1
                style="
                  margin:
                    0 0 14px;

                  font-size:23px;
                  line-height:1.3;
                  color:#2e261f;
                "
              >

                Código de recuperación

              </h1>


              <p
                style="
                  margin:
                    0 0 20px;

                  color:#6d5f53;
                  font-size:15px;
                  line-height:1.7;
                "
              >

                Hola

                <strong>

                  ${escaparHtml(
                    nombreUsuario
                  )}

                </strong>.

                Tu solicitud para
                cambiar la contraseña
                fue aprobada.

              </p>


              <p
                style="
                  margin:
                    0 0 10px;

                  color:#8a796a;
                  font-size:12px;
                  text-align:center;
                "
              >

                TU CÓDIGO

              </p>


              <div
                style="
                  margin:
                    0 auto 14px;

                  max-width:320px;

                  padding:
                    20px 18px;

                  background:#faf7f4;

                  border:
                    1px solid #eadfd5;

                  border-radius:12px;

                  text-align:center;

                  font-family:
                    monospace;

                  font-size:34px;

                  font-weight:800;

                  letter-spacing:
                    8px;

                  color:#2e261f;
                "
              >

                ${escaparHtml(
                  codigoFinal
                )}

              </div>


              <p
                style="
                  margin:
                    0 0 24px;

                  color:#8a796a;

                  font-size:12px;

                  text-align:center;

                  line-height:1.6;
                "
              >

                Este código vence
                en aproximadamente

                ${escaparHtml(
                  minutos
                )}

                minutos.

              </p>


              <div
                style="
                  text-align:center;
                  margin:
                    26px 0;
                "
              >

                <a
                  href="${escaparHtml(
                    url
                  )}"
                  style="
                    display:inline-block;
                    background:#c1541f;
                    color:#ffffff;
                    text-decoration:none;
                    font-size:14px;
                    font-weight:700;
                    padding:
                      13px 24px;
                    border-radius:9px;
                  "
                >

                  Ingresar código

                </a>

              </div>


              <div
                style="
                  margin-top:24px;
                  padding:
                    14px 16px;

                  background:#fff7ed;

                  border:
                    1px solid #fed7aa;

                  border-radius:10px;

                  color:#9a3412;

                  font-size:12px;

                  line-height:1.6;
                "
              >

                No compartas este código
                con otras personas.

                El administrador de
                RIMBERIO no necesita
                conocerlo.

              </div>


              <p
                style="
                  margin:
                    18px 0 0;

                  color:#8a796a;

                  font-size:12px;

                  line-height:1.6;
                "
              >

                Si no solicitaste recuperar
                tu contraseña, puedes
                ignorar este mensaje.

              </p>

            </td>

          </tr>


          <tr>

            <td
              style="
                padding:
                  18px 28px;

                background:#faf7f4;

                border-top:
                  1px solid #eadfd5;

                color:#8a796a;

                font-size:11px;

                line-height:1.6;
              "
            >

              Este es un mensaje
              automático de seguridad
              de RIMBERIO.

            </td>

          </tr>

        </table>

      </td>

    </tr>

  </table>

</body>

</html>
    `.trim()


    /* ======================================================
       ENVIAR CON BREVO
       ====================================================== */

    const resultado =
      await this
        .enviarCorreo({

          email:
            correo,


          nombre:
            nombreUsuario,


          subject,


          html
        })


    /*
     * IMPORTANTE:
     *
     * El código NO se devuelve aquí.
     *
     * Únicamente devolvemos información
     * del envío.
     */
    return {
      enviado:
        true,

      messageId:
        resultado.messageId,

      email:
        correo
    }
  }


  /* ========================================================
     VERIFICAR CONEXION
     ======================================================== */

  async verificarConexion() {

    /*
     * GET /v3/account
     *
     * Permite comprobar que:
     *
     * - Brevo responde
     * - BREVO_API_KEY es válida
     *
     * No enviamos ningún correo
     * durante esta prueba.
     */
    const resultado =
      await this
        .solicitarBrevo(
          "/account",
          {
            method:
              "GET"
          }
        )


    if (
      !resultado
    ) {

      throw new Error(
        "Brevo no devolvió información de la cuenta"
      )
    }


    return true
  }
}


export default new MailService()
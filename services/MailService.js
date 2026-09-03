import nodemailer from "nodemailer"

/**
 * Convierte texto a HTML seguro.
 * Evita que nombres o proyectos puedan
 * inyectar etiquetas dentro del correo.
 */
const escaparHtml = (valor = "") => {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

/**
 * Nombres visibles de los roles
 * internos del proyecto.
 */
const ROLE_LABELS = {
  owner: "Propietario",
  manager: "Responsable",
  developer: "Desarrollador",
  member: "Miembro",
  viewer: "Solo lectura"
}

class MailService {
  /**
   * Comprueba que Render tenga
   * configuradas las variables SMTP.
   */
  obtenerConfiguracion() {
    const host =
      process.env.SMTP_HOST

    const port =
      Number(
        process.env.SMTP_PORT ||
          465
      )

    const user =
      process.env.SMTP_USER

    const pass =
      process.env.SMTP_PASS

    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL

    if (!host) {
      throw new Error(
        "Falta configurar SMTP_HOST"
      )
    }

    if (!user) {
      throw new Error(
        "Falta configurar SMTP_USER"
      )
    }

    if (!pass) {
      throw new Error(
        "Falta configurar SMTP_PASS"
      )
    }

    if (!frontendUrl) {
      throw new Error(
        "Falta configurar FRONTEND_URL"
      )
    }

    /**
     * Puerto 465 normalmente usa TLS
     * desde el inicio.
     *
     * Puerto 587 normalmente inicia
     * sin secure y luego utiliza STARTTLS.
     */
    const secure =
      process.env.SMTP_SECURE !==
      undefined
        ? process.env.SMTP_SECURE ===
          "true"
        : port === 465

    return {
      host,
      port,
      user,
      pass,
      secure,
      frontendUrl:
        frontendUrl
          .split(",")[0]
          .trim()
          .replace(/\/+$/, "")
    }
  }

  /**
   * Crea la conexión SMTP.
   */
  crearTransporter() {
    const config =
      this.obtenerConfiguracion()

    return nodemailer.createTransport({
      host: config.host,

      port: config.port,

      secure: config.secure,

      auth: {
        user: config.user,
        pass: config.pass
      }
    })
  }

  /**
   * Genera el enlace que recibirá
   * el usuario invitado.
   */
  crearUrlInvitacion(token) {
    const {
      frontendUrl
    } = this.obtenerConfiguracion()

    const url =
      new URL(
        "/invitaciones/aceptar",
        frontendUrl
      )

    url.searchParams.set(
      "token",
      token
    )

    return url.toString()
  }

  /**
   * Envía una invitación
   * para unirse a un proyecto.
   */
  async enviarInvitacion({
    email,
    token,
    proyecto,
    invitador,
    role,
    expiresAt
  }) {
    const config =
      this.obtenerConfiguracion()

    const transporter =
      this.crearTransporter()

    const url =
      this.crearUrlInvitacion(
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
      ROLE_LABELS[role] ||
      role ||
      "Miembro"

    const fechaExpiracion =
      expiresAt
        ? new Date(
            expiresAt
          ).toLocaleDateString(
            "es-PE",
            {
              day: "2-digit",
              month: "long",
              year: "numeric"
            }
          )
        : "7 días"

    const from =
      process.env.MAIL_FROM ||
      `RIMBERIO <${config.user}>`

    const subject =
      `Invitación a ${nombreProyecto} | RIMBERIO`

    const text = `
Has sido invitado a colaborar en RIMBERIO.

Proyecto:
${nombreProyecto}

Invitado por:
${nombreInvitador}

Rol:
${nombreRol}

La invitación vence:
${fechaExpiracion}

Aceptar invitación:
${url}

Si no esperabas esta invitación, puedes ignorar este correo.
    `.trim()

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
      <td align="center">

        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          style="
            width:100%;
            max-width:600px;
            background:#ffffff;
            border:1px solid #eadfd5;
            border-radius:16px;
            overflow:hidden;
          "
        >

          <tr>
            <td
              style="
                padding:24px 28px;
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
                padding:32px 28px;
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
                Has recibido una
                invitación
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
                te ha invitado a
                colaborar en un
                proyecto de RIMBERIO.
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
                  href="${url}"
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
                Esta invitación vence el
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
                Debes iniciar sesión con
                el mismo correo al que se
                envió esta invitación.
              </p>

            </td>
          </tr>

          <tr>
            <td
              style="
                padding:18px 28px;
                background:#faf7f4;
                border-top:
                  1px solid #eadfd5;
                color:#8a796a;
                font-size:11px;
                line-height:1.6;
              "
            >
              Si no esperabas recibir
              esta invitación, puedes
              ignorar este mensaje.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `.trim()

    const resultado =
      await transporter.sendMail({
        from,
        to: email,
        subject,
        text,
        html
      })

    return {
      enviado: true,

      messageId:
        resultado.messageId,

      email,

      url
    }
  }

  /**
   * Sirve para comprobar la
   * configuración SMTP.
   *
   * Lo utilizaremos si necesitamos
   * diagnosticar el correo.
   */
  async verificarConexion() {
    const transporter =
      this.crearTransporter()

    await transporter.verify()

    return true
  }
}

export default new MailService()
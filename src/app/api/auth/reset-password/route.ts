import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { Resend } from "resend";

// No inicializar aquí para evitar errores en build de Vercel si la API key falta
// const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email es requerido" }, { status: 400 });
    }

    // 1. Generar el enlace mágico desde Firebase Admin
    const resetLink = await adminAuth.generatePasswordResetLink(email);

    // 2. Inicializar Resend aquí para evitar fallos en build
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 3. Enviar el correo personalizado con Resend
    const { data, error } = await resend.emails.send({
      from: "Soporte SynapTech <soporte@synaptechspa.cl>",
      to: email,
      subject: "Recupera tu contraseña - Club Patio",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Arial', sans-serif; background-color: #faf4e6; margin: 0; padding: 40px 20px; }
            .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 30px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
            .logo { width: 120px; margin-bottom: 20px; object-fit: contain; }
            .title { color: #1a1a2e; font-size: 24px; font-weight: 800; margin-bottom: 15px; }
            .text { color: #64748b; font-size: 16px; line-height: 1.5; margin-bottom: 30px; }
            .button { display: inline-block; background-color: #9DCC65; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(157, 204, 101, 0.4); transition: transform 0.2s; }
            .footer { margin-top: 30px; color: #a0aec0; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="https://club-patio-curauma.vercel.app/Logo2.png" alt="Club Patio Logo" class="logo" />
            <h2 class="title">Recupera tu contraseña</h2>
            <p class="text">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón de abajo para crear una nueva.</p>
            <a href="${resetLink}" class="button">Restablecer mi contraseña</a>
            <p class="text" style="margin-top: 25px; font-size: 14px;">Si no solicitaste este cambio, puedes ignorar este correo sin problemas.</p>
            <div class="footer">
              © ${new Date().getFullYear()} Club Patio Curauma. Todos los derechos reservados.
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error generating reset link:", error);
    return NextResponse.json(
      { error: "No se pudo procesar la solicitud. Verifica el correo e intenta de nuevo." },
      { status: 500 }
    );
  }
}

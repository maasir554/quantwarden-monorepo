import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization, magicLink, username } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { isEmailAuthEnabled, sendEmail } from "@/lib/mailer";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildBrandedEmail(otp: string, magicUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QuantWarden - Sign In</title>
</head>
<body style="margin:0;padding:0;background-color:#fffcf5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffcf5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(139,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#8B0000;padding:32px 40px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <div style="width:40px;height:40px;border:2px solid rgba(255,255,255,0.3);border-radius:10px;display:inline-block;text-align:center;line-height:40px;font-size:20px;color:#fff;">🛡</div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase;">QuantWarden</span>
                    <br/>
                    <span style="color:rgba(255,255,255,0.7);font-size:12px;letter-spacing:1px;">QUANTUM-PROOF SCANNER</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px 0;font-size:24px;font-weight:800;color:#3d200a;letter-spacing:-0.5px;">Sign In to Your Account</h1>
              <p style="margin:0 0 32px 0;font-size:14px;color:#8a5d33;line-height:1.6;">
                Use the verification code below to complete your sign-in. This code expires in <strong style="color:#8B0000;">10 minutes</strong>.
              </p>

              <!-- OTP Box -->
              <div style="background-color:#fdf1df;border:2px solid rgba(139,0,0,0.15);border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;">
                <p style="margin:0 0 12px 0;font-size:11px;font-weight:700;color:#8a5d33;text-transform:uppercase;letter-spacing:2px;">Your verification code</p>
                <div style="display:inline-block;font-size:36px;font-weight:900;letter-spacing:12px;color:#8B0000;font-family:'Courier New',monospace;padding:12px 24px;background-color:#ffffff;border-radius:8px;border:1px dashed rgba(139,0,0,0.25);cursor:pointer;-webkit-user-select:all;user-select:all;-moz-user-select:all;">
                  ${otp}
                </div>
                <p style="margin:10px 0 0 0;font-size:11px;color:#8a5d33;font-weight:600;">Tap the code to select, then copy</p>
              </div>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-bottom:1px solid #f0e6d0;"></td>
                  <td style="padding:0 16px;white-space:nowrap;font-size:11px;font-weight:700;color:#8a5d33;text-transform:uppercase;letter-spacing:1.5px;">or</td>
                  <td style="border-bottom:1px solid #f0e6d0;"></td>
                </tr>
              </table>

              <!-- Magic Link Button -->
              <p style="text-align:center;margin:0 0 16px 0;font-size:13px;color:#8a5d33;">
                Click the button below to sign in directly:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${magicUrl}" 
                       style="display:inline-block;background-color:#8B0000;color:#ffffff;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:0 4px 12px rgba(139,0,0,0.25);">
                      Sign In with Magic Link →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#fdf8f0;border-top:1px solid #f0e6d0;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:11px;color:#8a5d33;">
                If you didn't request this, you can safely ignore this email.
              </p>
              <p style="margin:0;font-size:10px;color:#c4a57b;letter-spacing:1px;text-transform:uppercase;font-weight:700;">
                © Team Keygen • QuantWarden
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  database: prismaAdapter(prisma, {
    provider: "postgresql", 
  }),
  emailAndPassword: {
    // Enabled for username + password accounts. Email users have no
    // credential account row, so they continue to use Magic Links + OTP only.
    enabled: true,
  },
  plugins: [
    username(),
    organization({
      // The Better Auth organization plugin handles multi-tenancy.
    }),
    magicLink({
      expiresIn: 600, // 10 minutes
      sendMagicLink: async ({ email, token, url }) => {
        if (!isEmailAuthEnabled()) {
          throw new Error("Email authentication is disabled.");
        }

        // Generate 6-digit OTP and store alongside the magic link token
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        // Invalidate any previous unused codes for this email
        await prisma.loginCode.updateMany({
          where: { email, used: false },
          data: { used: true }
        });

        // Store the new code
        await prisma.loginCode.create({
          data: {
            email,
            code: otp,
            token,
            url,
            expiresAt,
          }
        });

        // Send the branded email with OTP + magic link through the SMTP relay
        try {
          await sendEmail({
            to: email,
            subject: `${otp} is your QuantWarden verification code`,
            html: buildBrandedEmail(otp, url),
          });
        } catch (error) {
          console.error("Failed to send magic link email:", error);
        }
      },
    }),
  ],
});

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: `"FEXA" <${process.env.EMAIL_USER}>`,

    to: email,

    subject: "Your FEXA Email Verification Code",

    html: `
      <div style="
        font-family: Arial, sans-serif;
        background: #faf8fc;
        padding: 40px 20px;
      ">

        <div style="
          max-width: 500px;
          margin: auto;
          background: white;
          padding: 40px;
          border-radius: 12px;
          text-align: center;
        ">

          <h1 style="
            color: #3b3047;
            letter-spacing: 5px;
            margin-bottom: 5px;
          ">
            FEXA
          </h1>

          <p style="
            color: #a184bd;
            font-size: 10px;
            letter-spacing: 3px;
          ">
            HAUTE PARFUMERIE
          </p>

          <hr style="
            border: none;
            border-top: 1px solid #eee7f3;
            margin: 30px 0;
          " />

          <h2 style="
            color: #332a3d;
            font-weight: 500;
          ">
            Verify Your Email
          </h2>

          <p style="
            color: #817789;
            line-height: 1.6;
          ">
            Use the verification code below
            to complete your FEXA registration.
          </p>

          <div style="
            margin: 30px 0;
            padding: 18px;
            background: #f3ecf9;
            border-radius: 8px;
            color: #765493;
            font-size: 30px;
            font-weight: bold;
            letter-spacing: 8px;
          ">
            ${otp}
          </div>

          <p style="
            color: #9a8e9f;
            font-size: 12px;
          ">
            This code will expire in 1 minute.
          </p>

          <p style="
            margin-top: 35px;
            color: #b0a6b7;
            font-size: 10px;
            letter-spacing: 1px;
          ">
            FEXA · CRAFTED FOR THE SENSES
          </p>

        </div>

      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};





// ========================================
// SEND PASSWORD RESET EMAIL
// ========================================

const sendPasswordResetEmail = async (
  email,
  resetToken
) => {

  const resetLink =
    `http://localhost:5173/reset-password/${resetToken}`;

  const mailOptions = {
    from: `"FEXA" <${process.env.EMAIL_USER}>`,

    to: email,

    subject: "Reset Your FEXA Password",

    html: `
      <div style="
        font-family: Arial, sans-serif;
        background: #faf8fc;
        padding: 40px 20px;
      ">

        <div style="
          max-width: 500px;
          margin: auto;
          background: white;
          padding: 40px;
          border-radius: 12px;
          text-align: center;
        ">

          <h1 style="
            color: #3b3047;
            letter-spacing: 5px;
            margin-bottom: 5px;
          ">
            FEXA
          </h1>

          <p style="
            color: #a184bd;
            font-size: 10px;
            letter-spacing: 3px;
          ">
            HAUTE PARFUMERIE
          </p>

          <hr style="
            border: none;
            border-top: 1px solid #eee7f3;
            margin: 30px 0;
          " />

          <h2 style="
            color: #332a3d;
            font-weight: 500;
          ">
            Reset Your Password
          </h2>

          <p style="
            color: #817789;
            line-height: 1.6;
          ">
            We received a request to reset your
            FEXA account password.
          </p>

          <a
            href="${resetLink}"
            style="
              display: inline-block;
              margin: 25px 0;
              padding: 14px 30px;
              background: #765493;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-size: 14px;
              letter-spacing: 1px;
            "
          >
            RESET PASSWORD
          </a>

          <p style="
            color: #9a8e9f;
            font-size: 12px;
          ">
            This link will expire in 15 minutes.
          </p>

          <p style="
            color: #b0a6b7;
            font-size: 11px;
            margin-top: 30px;
          ">
            If you did not request a password reset,
            you can safely ignore this email.
          </p>

          <p style="
            margin-top: 35px;
            color: #b0a6b7;
            font-size: 10px;
            letter-spacing: 1px;
          ">
            FEXA · CRAFTED FOR THE SENSES
          </p>

        </div>

      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

const sendEmailChangeOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: `"FEXA" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify Your New Email - FEXA",
    html: `
      <div style="
        font-family: Arial, sans-serif;
        background: #faf8fc;
        padding: 40px 20px;
      ">
        <div style="
          max-width: 500px;
          margin: auto;
          background: white;
          padding: 40px;
          border-radius: 12px;
          text-align: center;
        ">
          <h1 style="
            color: #3b3047;
            letter-spacing: 5px;
            margin-bottom: 5px;
          ">
            FEXA
          </h1>
          <p style="
            color: #a184bd;
            font-size: 10px;
            letter-spacing: 3px;
          ">
            HAUTE PARFUMERIE
          </p>
          <hr style="
            border: none;
            border-top: 1px solid #eee7f3;
            margin: 30px 0;
          " />
          <h2 style="
            color: #332a3d;
            font-weight: 500;
          ">
            Verify Your New Email Address
          </h2>
          <p style="
            color: #817789;
            line-height: 1.6;
          ">
            Please use the verification code below to confirm your new email address for your FEXA account.
          </p>
          <div style="
            margin: 30px 0;
            padding: 18px;
            background: #f3ecf9;
            border-radius: 8px;
            color: #765493;
            font-size: 30px;
            font-weight: bold;
            letter-spacing: 8px;
          ">
            ${otp}
          </div>
          <p style="
            color: #9a8e9f;
            font-size: 12px;
          ">
            This code will expire in 5 minutes.
          </p>
          <p style="
            margin-top: 35px;
            color: #b0a6b7;
            font-size: 10px;
            letter-spacing: 1px;
          ">
            FEXA · CRAFTED FOR THE SENSES
          </p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

const sendContactConfirmationEmail = async ({ name, email, reason, subject, message, orderNumber }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return false;
  }

  const mailOptions = {
    from: `"FEXA Concierge" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `We've Received Your Inquiry: ${subject} - FEXA`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #faf8fc; padding: 40px 20px; color: #30263b;">
        <div style="max-width: 560px; margin: auto; background: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #ebe4f3; box-shadow: 0 10px 30px rgba(118, 84, 147, 0.08);">
          <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="color: #241a30; letter-spacing: 6px; font-size: 26px; font-weight: 500; margin: 0 0 4px; font-family: Georgia, serif;">FEXA</h1>
            <p style="color: #8c69ae; font-size: 9px; letter-spacing: 3px; margin: 0; text-transform: uppercase;">HAUTE PARFUMERIE · ATELIER CONCIERGE</p>
          </div>
          <hr style="border: none; border-top: 1px solid #eee7f3; margin: 25px 0;" />
          <h2 style="color: #241a30; font-size: 18px; font-weight: 600; margin: 0 0 12px;">Dear ${name},</h2>
          <p style="color: #635770; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            Thank you for reaching out to FEXA. Our atelier team has safely received your message. Every fragrance inquiry is handled with personalized care, and our specialists will review and respond to you shortly.
          </p>
          <div style="background: #faf8fc; border: 1px solid #ebdff5; border-radius: 10px; padding: 20px; margin-bottom: 25px;">
            <p style="margin: 0 0 8px; font-size: 12px; color: #8c69ae; letter-spacing: 1px; font-weight: 700; text-transform: uppercase;">Inquiry Summary</p>
            <p style="margin: 0 0 6px; font-size: 13px; color: #30263b;"><strong>Topic:</strong> ${reason}</p>
            ${orderNumber ? `<p style="margin: 0 0 6px; font-size: 13px; color: #30263b;"><strong>Order:</strong> #${orderNumber}</p>` : ""}
            <p style="margin: 0 0 6px; font-size: 13px; color: #30263b;"><strong>Subject:</strong> ${subject}</p>
            <p style="margin: 0; font-size: 13px; color: #635770; font-style: italic;">"${message.length > 200 ? message.slice(0, 197) + "..." : message}"</p>
          </div>
          <p style="color: #776d80; font-size: 12px; line-height: 1.5; margin: 0 0 30px;">
            If you need immediate assistance with an ongoing order, you can also view current dispatch details inside your <a href="http://localhost:5173/profile" style="color: #765493; text-decoration: underline;">FEXA Profile</a>.
          </p>
          <div style="text-align: center; border-top: 1px solid #f0e8f6; padding-top: 20px;">
            <p style="color: #a095ab; font-size: 10px; letter-spacing: 1.5px; margin: 0;">
              FEXA HAUTE PARFUMERIE · CRAFTED WITH QUIET RESTRAINT
            </p>
          </div>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  return true;
};

export {
  sendOtpEmail,
  sendPasswordResetEmail,
  sendEmailChangeOtpEmail,
  sendContactConfirmationEmail,
};

export default {
  sendOtpEmail,
  sendPasswordResetEmail,
  sendEmailChangeOtpEmail,
  sendContactConfirmationEmail,
};
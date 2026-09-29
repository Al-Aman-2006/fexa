const nodemailer = require("nodemailer");

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

module.exports = {
  sendOtpEmail,
  sendPasswordResetEmail,
};
const { saveConfirmation, checkEmailExists } = require("../lib/firebase");

const confirmPresence = async (req, res) => {
  const { name, email, whatsapp, guestCount, message } = req.body;

  if (!email) return res.status(400).json({ message: "E-mail é obrigatório." });

  try {
    const alreadyExists = await checkEmailExists(email);
    if (alreadyExists) {
      return res
        .status(409)
        .json({ message: "Este email já confirmou presença." });
    }

    await saveConfirmation({
      name,
      email,
      whatsapp,
      guestCount,
      message,
      status: "pending",
      emailSent: false,
      createdAt: new Date().toISOString(),
    });

    res.status(200).json({ message: "Recebido com sucesso!" });
  } catch (error) {
    console.error("Erro RSVP:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};

module.exports = { confirmPresence };

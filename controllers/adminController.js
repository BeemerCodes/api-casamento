const {
  getApprovedPendingGuests,
  markGuestAsNotified,
} = require("../lib/firebase");

const EVENT_INFO = {
  date: "09/05/2026",
  time: "16:00",
  location: "Espaço Garden - Rua das Flores, 123, Sorocaba - SP",
  mapLink: "https://goo.gl/maps/SEU_LINK_AQUI",
};

const sendEmail = async (emailData) => {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(emailData),
    });

    return response.ok;
  } catch (error) {
    console.error("Erro ao enviar email:", error.message);
    return false;
  }
};

const parseDate = (dateVal) => {
  if (!dateVal) return null;
  if (typeof dateVal.toDate === "function") return dateVal.toDate();
  return new Date(dateVal);
};

const runEmailJob = async (req, res) => {
  const jobToken = req.headers["x-job-key"];

  if (jobToken !== process.env.JOB_SECRET) {
    return res.status(403).json({ message: "Acesso negado: token inválido." });
  }

  try {
    const guests = await getApprovedPendingGuests();

    if (guests.length === 0) {
      return res.status(200).json({ message: "Nenhum convidado pendente." });
    }

    console.log(`[JOB] Verificando ${guests.length} convidados aprovados...`);

    const now = new Date();
    const results = [];
    const DELAY_MINUTES = 1440; // 24 Horas

    for (const guest of guests) {
      if (guest.approvedAt) {
        const approvedTime = parseDate(guest.approvedAt);

        if (!approvedTime || isNaN(approvedTime.getTime())) {
          console.error(
            `[ERRO] Data inválida para ${guest.email}:`,
            guest.approvedAt
          );
          results.push({ email: guest.email, status: "erro_data_invalida" });
          continue;
        }

        const diffMinutes = (now - approvedTime) / 1000 / 60;

        if (diffMinutes < DELAY_MINUTES) {
          console.log(
            `⏳ ${guest.name}: Aguardando tempo (${Math.floor(
              diffMinutes
            )}/${DELAY_MINUTES} min)`
          );
          results.push({ email: guest.email, status: "aguardando_24h" });
          continue;
        }
      } else {
        continue;
      }

      // --- EMAIL ---
      const htmlContent = `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
                    <div style="background-color: #f8f8f8; padding: 20px; text-align: center;">
                        <h2 style="color: #d97706; margin:0;">Presença Confirmada! 🎉</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>Olá, <strong>${guest.name}</strong>!</p>
                        <p>Ficamos felizes em confirmar sua presença! Aqui estão os detalhes:</p>
                        
                        <div style="background-color: #fffaf0; border-left: 4px solid #d97706; padding: 15px; margin: 20px 0;">
                            <p><strong>📅 Data:</strong> ${EVENT_INFO.date}</p>
                            <p><strong>⏰ Horário:</strong> ${EVENT_INFO.time}</p>
                            <p><strong>📍 Local:</strong> ${EVENT_INFO.location}</p>
                        </div>

                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${EVENT_INFO.mapLink}" style="background-color: #333; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px;">Ver no Mapa</a>
                        </div>
                    </div>
                </div>
            `;

      const sent = await sendEmail({
        sender: { name: "Casamento Veronica", email: process.env.EMAIL_SENDER },
        to: [{ email: guest.email, name: guest.name }],
        subject: "Sua presença foi confirmada! Veja os detalhes.",
        htmlContent: htmlContent,
      });

      if (sent) {
        await markGuestAsNotified(guest.id);
        results.push({ email: guest.email, status: "enviado" });
      } else {
        results.push({ email: guest.email, status: "erro_api_email" });
      }
    }

    return res.status(200).json({
      message: "Job concluído.",
      details: results,
    });
  } catch (error) {
    console.error("Erro no job:", error);
    return res.status(500).json({ message: "Erro interno." });
  }
};

module.exports = { runEmailJob };

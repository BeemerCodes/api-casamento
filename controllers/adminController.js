// ATENÇÃO: Verifique se no seu lib/firebase.js você exportou getApprovedPendingGuests corretamente
const {
  getApprovedPendingGuests,
  markGuestAsNotified,
} = require("../lib/firebase");

// DADOS DO EVENTO
const EVENT_INFO = {
  date: "20/12/2026",
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

    // Brevo retorna 201 ou 200 se der certo
    return response.ok;
  } catch (error) {
    console.error("Erro ao enviar email:", error.message);
    return false;
  }
};

const runEmailJob = async (req, res) => {
  const jobToken = req.headers["x-job-key"];

  if (jobToken !== process.env.JOB_SECRET) {
    return res.status(403).json({ message: "Acesso negado: token inválido." });
  }

  try {
    // Busca APENAS aprovados pendentes de email
    const guests = await getApprovedPendingGuests();

    if (guests.length === 0) {
      return res.status(200).json({ message: "Nenhum convidado pendente." });
    }

    console.log(`[JOB] Verificando ${guests.length} convidados aprovados...`);

    const now = new Date();
    const results = [];

    for (const guest of guests) {
      // --- LÓGICA DOS 15 MINUTOS ---
      if (guest.approvedAt) {
        const approvedTime = new Date(guest.approvedAt);
        const diffMinutes = (now - approvedTime) / 1000 / 60;

        // Se passou menos de 15 minutos, PULA este convidado
        if (diffMinutes < 15) {
          console.log(
            `⏳ ${guest.name}: Aguardando tempo (${Math.floor(
              diffMinutes
            )} min)`
          );
          results.push({ email: guest.email, status: "aguardando_15min" });
          continue;
        }
      } else {
        // Se não tem approvedAt, ignoramos para segurança
        continue;
      }

      // --- CONTEÚDO DO EMAIL ---
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

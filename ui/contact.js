const form = document.getElementById("contactForm");
const statusNode = document.getElementById("contactStatus");

if (form && statusNode) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const subject = String(formData.get("subject") || "").trim();
    const message = String(formData.get("message") || "").trim();

    if (!message) {
      statusNode.textContent = "Add a comment first so we can build the email draft.";
      return;
    }

    const subjectLine = subject || "LEOFF Helper feedback";
    const bodyParts = [];

    if (name) bodyParts.push(`Name: ${name}`);
    if (email) bodyParts.push(`Reply email: ${email}`);
    bodyParts.push("");
    bodyParts.push(message);

    const mailtoHref = `mailto:leoffhelper@gmail.com?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(bodyParts.join("\n"))}`;
    statusNode.textContent = "Opening your email app with a draft message.";
    window.location.href = mailtoHref;
  });
}

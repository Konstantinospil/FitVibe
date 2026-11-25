/**
 * Simple i18n service for backend email templates
 * Supports multiple languages with fallback to English
 */

type SupportedLanguage = "en" | "de" | "es" | "fr" | "el";

interface EmailTranslations {
  verification: {
    subject: string;
    welcome: string;
    verifyButton: string;
    orCopy: string;
    expiresIn: string;
    minutes: string;
  };
  resend: {
    subject: string;
    title: string;
    message: string;
    verifyButton: string;
    orCopy: string;
    expiresIn: string;
    minutes: string;
  };
  registrationContinue: {
    subject: string;
    title: string;
    message: string;
    continueButton: string;
    orCopy: string;
    expiresIn: string;
    minutes: string;
    ignore: string;
  };
  registrationAttempt: {
    subject: string;
    title: string;
    message: string;
    signInButton: string;
    resetPrompt: string;
    resetLink: string;
    ignore: string;
  };
}

const translations: Record<SupportedLanguage, EmailTranslations> = {
  en: {
    verification: {
      subject: "Verify your FitVibe account",
      welcome: "Welcome to FitVibe!",
      verifyButton: "Verify Email Address",
      orCopy: "Or copy and paste this link into your browser:",
      expiresIn: "This link will expire in",
      minutes: "minutes",
    },
    resend: {
      subject: "Verify your FitVibe account",
      title: "Verify your FitVibe account",
      message:
        "We received a request to resend your verification email. Please verify your email address by clicking the link below:",
      verifyButton: "Verify Email Address",
      orCopy: "Or copy and paste this link into your browser:",
      expiresIn: "This link will expire in",
      minutes: "minutes",
    },
    registrationContinue: {
      subject: "Finish creating your FitVibe account",
      title: "Finish creating your FitVibe account",
      message:
        "Thanks for signing up. Follow the link below to choose your username and password and finish creating your account.",
      continueButton: "Continue registration",
      orCopy: "Or copy and paste this link into your browser:",
      expiresIn: "This link will expire in",
      minutes: "minutes",
      ignore:
        "If you did not try to sign up for FitVibe, you can ignore this email. No account has been created.",
    },
    registrationAttempt: {
      subject: "Someone tried to register with your FitVibe email address",
      title: "Registration attempt for your account",
      message:
        "Someone just tried to create a new FitVibe account with this email address. You already have an account, so no new account was created.",
      signInButton: "Sign in",
      resetPrompt: "Forgot your password?",
      resetLink: "Reset your password",
      ignore: "If this was not you, you can ignore this email. Your account has not been changed.",
    },
  },
  de: {
    verification: {
      subject: "Bestätigen Sie Ihr FitVibe-Konto",
      welcome: "Willkommen bei FitVibe!",
      verifyButton: "E-Mail-Adresse bestätigen",
      orCopy: "Oder kopieren Sie diesen Link in Ihren Browser:",
      expiresIn: "Dieser Link läuft ab in",
      minutes: "Minuten",
    },
    resend: {
      subject: "Bestätigen Sie Ihr FitVibe-Konto",
      title: "Bestätigen Sie Ihr FitVibe-Konto",
      message:
        "Wir haben eine Anfrage erhalten, Ihre Bestätigungs-E-Mail erneut zu senden. Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf den untenstehenden Link klicken:",
      verifyButton: "E-Mail-Adresse bestätigen",
      orCopy: "Oder kopieren Sie diesen Link in Ihren Browser:",
      expiresIn: "Dieser Link läuft ab in",
      minutes: "Minuten",
    },
    registrationContinue: {
      subject: "Schließen Sie die Erstellung Ihres FitVibe-Kontos ab",
      title: "Schließen Sie die Erstellung Ihres FitVibe-Kontos ab",
      message:
        "Danke für Ihre Anmeldung. Über den Link unten wählen Sie Ihren Benutzernamen und Ihr Passwort und schließen die Kontoerstellung ab.",
      continueButton: "Registrierung fortsetzen",
      orCopy: "Oder kopieren Sie diesen Link in Ihren Browser:",
      expiresIn: "Dieser Link läuft ab in",
      minutes: "Minuten",
      ignore:
        "Wenn Sie sich nicht bei FitVibe registrieren wollten, können Sie diese E-Mail ignorieren. Es wurde kein Konto erstellt.",
    },
    registrationAttempt: {
      subject: "Jemand hat versucht, sich mit Ihrer FitVibe-E-Mail-Adresse zu registrieren",
      title: "Registrierungsversuch für Ihr Konto",
      message:
        "Jemand hat gerade versucht, mit dieser E-Mail-Adresse ein neues FitVibe-Konto zu erstellen. Sie haben bereits ein Konto, daher wurde kein neues Konto erstellt.",
      signInButton: "Anmelden",
      resetPrompt: "Passwort vergessen?",
      resetLink: "Passwort zurücksetzen",
      ignore:
        "Wenn Sie das nicht waren, können Sie diese E-Mail ignorieren. Ihr Konto wurde nicht verändert.",
    },
  },
  es: {
    verification: {
      subject: "Verifica tu cuenta de FitVibe",
      welcome: "¡Bienvenido a FitVibe!",
      verifyButton: "Verificar dirección de correo",
      orCopy: "O copia y pega este enlace en tu navegador:",
      expiresIn: "Este enlace expirará en",
      minutes: "minutos",
    },
    resend: {
      subject: "Verifica tu cuenta de FitVibe",
      title: "Verifica tu cuenta de FitVibe",
      message:
        "Recibimos una solicitud para reenviar tu correo de verificación. Por favor, verifica tu dirección de correo haciendo clic en el enlace a continuación:",
      verifyButton: "Verificar dirección de correo",
      orCopy: "O copia y pega este enlace en tu navegador:",
      expiresIn: "Este enlace expirará en",
      minutes: "minutos",
    },
    registrationContinue: {
      subject: "Termina de crear tu cuenta de FitVibe",
      title: "Termina de crear tu cuenta de FitVibe",
      message:
        "Gracias por registrarte. Sigue el enlace de abajo para elegir tu nombre de usuario y contraseña y terminar de crear tu cuenta.",
      continueButton: "Continuar el registro",
      orCopy: "O copia y pega este enlace en tu navegador:",
      expiresIn: "Este enlace expirará en",
      minutes: "minutos",
      ignore:
        "Si no intentaste registrarte en FitVibe, puedes ignorar este correo. No se ha creado ninguna cuenta.",
    },
    registrationAttempt: {
      subject: "Alguien intentó registrarse con tu correo de FitVibe",
      title: "Intento de registro con tu cuenta",
      message:
        "Alguien acaba de intentar crear una nueva cuenta de FitVibe con esta dirección de correo. Ya tienes una cuenta, así que no se creó ninguna cuenta nueva.",
      signInButton: "Iniciar sesión",
      resetPrompt: "¿Olvidaste tu contraseña?",
      resetLink: "Restablecer tu contraseña",
      ignore: "Si no fuiste tú, puedes ignorar este correo. Tu cuenta no ha cambiado.",
    },
  },
  fr: {
    verification: {
      subject: "Vérifiez votre compte FitVibe",
      welcome: "Bienvenue sur FitVibe !",
      verifyButton: "Vérifier l'adresse e-mail",
      orCopy: "Ou copiez et collez ce lien dans votre navigateur :",
      expiresIn: "Ce lien expirera dans",
      minutes: "minutes",
    },
    resend: {
      subject: "Vérifiez votre compte FitVibe",
      title: "Vérifiez votre compte FitVibe",
      message:
        "Nous avons reçu une demande de renvoi de votre e-mail de vérification. Veuillez vérifier votre adresse e-mail en cliquant sur le lien ci-dessous :",
      verifyButton: "Vérifier l'adresse e-mail",
      orCopy: "Ou copiez et collez ce lien dans votre navigateur :",
      expiresIn: "Ce lien expirera dans",
      minutes: "minutes",
    },
    registrationContinue: {
      subject: "Terminez la création de votre compte FitVibe",
      title: "Terminez la création de votre compte FitVibe",
      message:
        "Merci de votre inscription. Suivez le lien ci-dessous pour choisir votre nom d'utilisateur et votre mot de passe et terminer la création de votre compte.",
      continueButton: "Poursuivre l'inscription",
      orCopy: "Ou copiez et collez ce lien dans votre navigateur :",
      expiresIn: "Ce lien expirera dans",
      minutes: "minutes",
      ignore:
        "Si vous n'avez pas essayé de vous inscrire sur FitVibe, vous pouvez ignorer cet e-mail. Aucun compte n'a été créé.",
    },
    registrationAttempt: {
      subject: "Quelqu'un a tenté de s'inscrire avec votre adresse e-mail FitVibe",
      title: "Tentative d'inscription avec votre compte",
      message:
        "Quelqu'un vient d'essayer de créer un nouveau compte FitVibe avec cette adresse e-mail. Vous avez déjà un compte, aucun nouveau compte n'a donc été créé.",
      signInButton: "Se connecter",
      resetPrompt: "Mot de passe oublié ?",
      resetLink: "Réinitialiser votre mot de passe",
      ignore:
        "Si ce n'était pas vous, vous pouvez ignorer cet e-mail. Votre compte n'a pas été modifié.",
    },
  },
  el: {
    verification: {
      subject: "Επαληθεύστε τον λογαριασμό σας στο FitVibe",
      welcome: "Καλώς ήρθατε στο FitVibe!",
      verifyButton: "Επαλήθευση διεύθυνσης email",
      orCopy: "Ή αντιγράψτε και επικολλήστε αυτόν τον σύνδεσμο στον περιηγητή σας:",
      expiresIn: "Αυτός ο σύνδεσμος θα λήξει σε",
      minutes: "λεπτά",
    },
    resend: {
      subject: "Επαληθεύστε τον λογαριασμό σας στο FitVibe",
      title: "Επαληθεύστε τον λογαριασμό σας στο FitVibe",
      message:
        "Λάβαμε αίτημα για επαναποστολή του email επαλήθευσης. Παρακαλώ επαληθεύστε τη διεύθυνση email σας κάνοντας κλικ στον παρακάτω σύνδεσμο:",
      verifyButton: "Επαλήθευση διεύθυνσης email",
      orCopy: "Ή αντιγράψτε και επικολλήστε αυτόν τον σύνδεσμο στον περιηγητή σας:",
      expiresIn: "Αυτός ο σύνδεσμος θα λήξει σε",
      minutes: "λεπτά",
    },
    registrationContinue: {
      subject: "Ολοκληρώστε τη δημιουργία του λογαριασμού σας στο FitVibe",
      title: "Ολοκληρώστε τη δημιουργία του λογαριασμού σας στο FitVibe",
      message:
        "Ευχαριστούμε για την εγγραφή. Ακολουθήστε τον παρακάτω σύνδεσμο για να επιλέξετε όνομα χρήστη και κωδικό πρόσβασης και να ολοκληρώσετε τη δημιουργία του λογαριασμού σας.",
      continueButton: "Συνέχεια εγγραφής",
      orCopy: "Ή αντιγράψτε και επικολλήστε αυτόν τον σύνδεσμο στο πρόγραμμα περιήγησής σας:",
      expiresIn: "Αυτός ο σύνδεσμος θα λήξει σε",
      minutes: "λεπτά",
      ignore:
        "Αν δεν προσπαθήσατε να εγγραφείτε στο FitVibe, μπορείτε να αγνοήσετε αυτό το email. Δεν δημιουργήθηκε λογαριασμός.",
    },
    registrationAttempt: {
      subject: "Κάποιος προσπάθησε να εγγραφεί με το email σας στο FitVibe",
      title: "Απόπειρα εγγραφής για τον λογαριασμό σας",
      message:
        "Κάποιος μόλις προσπάθησε να δημιουργήσει νέο λογαριασμό FitVibe με αυτή τη διεύθυνση email. Έχετε ήδη λογαριασμό, οπότε δεν δημιουργήθηκε νέος λογαριασμός.",
      signInButton: "Σύνδεση",
      resetPrompt: "Ξεχάσατε τον κωδικό σας;",
      resetLink: "Επαναφορά κωδικού πρόσβασης",
      ignore:
        "Αν δεν ήσασταν εσείς, μπορείτε να αγνοήσετε αυτό το email. Ο λογαριασμός σας δεν άλλαξε.",
    },
  },
};

/**
 * Get email translations for a given language
 * Falls back to English if language is not supported
 */
export function getEmailTranslations(lang?: string | null): EmailTranslations {
  const normalizedLang = lang?.toLowerCase().split("-")[0] as SupportedLanguage | undefined;
  return translations[normalizedLang || "en"] || translations.en;
}

/**
 * Generate verification email HTML template
 */
export function generateVerificationEmailHtml(
  verificationUrl: string,
  expiresInMinutes: number,
  lang?: string | null,
): string {
  const t = getEmailTranslations(lang);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${t.verification.welcome}</h2>
      <p>Thank you for registering. Please verify your email address by clicking the link below:</p>
      <p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
          ${t.verification.verifyButton}
        </a>
      </p>
      <p>${t.verification.orCopy}</p>
      <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">
        ${t.verification.expiresIn} ${expiresInMinutes} ${t.verification.minutes}.
      </p>
    </div>
  `;
}

/**
 * Generate verification email text template
 */
export function generateVerificationEmailText(
  verificationUrl: string,
  expiresInMinutes: number,
  lang?: string | null,
): string {
  const t = getEmailTranslations(lang);
  return `${t.verification.welcome} Please verify your email address by visiting: ${verificationUrl}\n\n${t.verification.expiresIn} ${expiresInMinutes} ${t.verification.minutes}.`;
}

/**
 * Generate resend verification email HTML template
 */
export function generateResendVerificationEmailHtml(
  verificationUrl: string,
  expiresInMinutes: number,
  lang?: string | null,
): string {
  const t = getEmailTranslations(lang);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${t.resend.title}</h2>
      <p>${t.resend.message}</p>
      <p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
          ${t.resend.verifyButton}
        </a>
      </p>
      <p>${t.resend.orCopy}</p>
      <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">
        ${t.resend.expiresIn} ${expiresInMinutes} ${t.resend.minutes}.
      </p>
    </div>
  `;
}

/**
 * Generate resend verification email text template
 */
export function generateResendVerificationEmailText(
  verificationUrl: string,
  expiresInMinutes: number,
  lang?: string | null,
): string {
  const t = getEmailTranslations(lang);
  return `${t.resend.title} ${t.resend.message} ${verificationUrl}\n\n${t.resend.expiresIn} ${expiresInMinutes} ${t.resend.minutes}.`;
}

/**
 * Email-first registration (ADR-039): link that lets the owner of a new
 * address finish creating the account.
 */
export function generateRegistrationContinueEmailHtml(
  continueUrl: string,
  expiresInMinutes: number,
  lang?: string | null,
): string {
  const t = getEmailTranslations(lang).registrationContinue;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${t.title}</h2>
      <p>${t.message}</p>
      <p>
        <a href="${continueUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
          ${t.continueButton}
        </a>
      </p>
      <p>${t.orCopy}</p>
      <p style="color: #666; word-break: break-all;">${continueUrl}</p>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">
        ${t.expiresIn} ${expiresInMinutes} ${t.minutes}. ${t.ignore}
      </p>
    </div>
  `;
}

export function generateRegistrationContinueEmailText(
  continueUrl: string,
  expiresInMinutes: number,
  lang?: string | null,
): string {
  const t = getEmailTranslations(lang).registrationContinue;
  return `${t.title}\n\n${t.message}\n\n${t.continueButton}: ${continueUrl}\n\n${t.expiresIn} ${expiresInMinutes} ${t.minutes}.\n${t.ignore}`;
}

/**
 * Email-first registration (ADR-039): sent instead of a link when the address
 * already has an account. It reaches only the mailbox owner.
 */
export function generateRegistrationAttemptEmailHtml(
  loginUrl: string,
  resetUrl: string,
  lang?: string | null,
): string {
  const t = getEmailTranslations(lang).registrationAttempt;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${t.title}</h2>
      <p>${t.message}</p>
      <p>
        <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
          ${t.signInButton}
        </a>
      </p>
      <p>${t.resetPrompt} <a href="${resetUrl}">${t.resetLink}</a></p>
      <p style="color: #999; font-size: 12px; margin-top: 32px;">
        ${t.ignore}
      </p>
    </div>
  `;
}

export function generateRegistrationAttemptEmailText(
  loginUrl: string,
  resetUrl: string,
  lang?: string | null,
): string {
  const t = getEmailTranslations(lang).registrationAttempt;
  return `${t.title}\n\n${t.message}\n\n${t.signInButton}: ${loginUrl}\n${t.resetPrompt} ${resetUrl}\n\n${t.ignore}`;
}

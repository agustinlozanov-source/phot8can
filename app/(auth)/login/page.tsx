import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[3fr_1fr]">
      {/* Lado izquierdo — Video 3/4 */}
      <div className="hidden lg:block relative bg-black overflow-hidden">
        <video
          src="/videos/login.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay sutil para que el logo sea legible */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Logo top-left */}
        <div className="absolute top-8 left-10 z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center font-bold text-lg text-black">
            P
          </div>
          <div>
            <div className="text-white font-semibold leading-none">
              Photocan OS
            </div>
            <div className="text-white/50 text-[10px] font-mono uppercase tracking-wider mt-0.5">
              Sistema operativo
            </div>
          </div>
        </div>

        {/* Footer bottom-left */}
        <div className="absolute bottom-8 left-10 z-10 font-mono text-xs text-white/30 uppercase tracking-wider">
          v0.1 · Mayo 2026
        </div>
      </div>

      {/* Lado derecho — Formulario 1/4 */}
      <div className="flex items-center justify-center p-6 lg:p-8 bg-background">
        <div className="w-full max-w-xs">
          {/* Logo móvil */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center font-bold text-xl text-black">
              P
            </div>
            <div>
              <div className="font-semibold text-lg leading-none">
                Photocan OS
              </div>
              <div className="text-muted-foreground text-xs font-mono uppercase tracking-wider mt-1">
                Sistema operativo
              </div>
            </div>
          </div>

          {/* Encabezado */}
          <div className="mb-6">
            <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-2">
              · Acceso
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-1">
              Bienvenido
            </h2>
            <p className="text-muted-foreground text-xs">
              Ingresa tus credenciales para acceder.
            </p>
          </div>

          <LoginForm />

          <div className="mt-6 text-[10px] text-muted-foreground font-mono text-center leading-relaxed">
            ¿Problemas para acceder?
            <br />
            Contacta a tu administrador.
          </div>
        </div>
      </div>
    </div>
  );
}

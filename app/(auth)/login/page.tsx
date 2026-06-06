import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Lado izquierdo - Imagen / Branding */}
      <div className="hidden lg:flex relative bg-black overflow-hidden">
        {/* Glow ámbar de fondo */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 30% 40%, rgba(232,154,31,0.15), transparent 60%), radial-gradient(ellipse 50% 60% at 70% 80%, rgba(232,154,31,0.08), transparent 60%)',
          }}
        />

        {/* Contenido del lado izquierdo */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo top */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-photocan-amber to-photocan-amber-deep grid place-items-center font-bold text-xl text-black">
              P
            </div>
            <div>
              <div className="text-white font-semibold text-lg leading-none">
                Photocan OS
              </div>
              <div className="text-white/50 text-xs font-mono uppercase tracking-wider mt-1">
                Sistema operativo
              </div>
            </div>
          </div>

          {/* Texto central */}
          <div className="max-w-md">
            <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
              <span className="w-6 h-px bg-photocan-amber" />
              Para agencias que escalan
            </div>
            <h1 className="text-white text-5xl font-semibold leading-tight tracking-tight mb-6">
              El sistema que gobierna tu operación.
            </h1>
            <p className="text-white/60 text-base leading-relaxed">
              Una sola plataforma para clientes, estrategia, producción,
              cobranza y comunicación. Construido para que el equipo creativo
              dedique su tiempo a lo creativo.
            </p>
          </div>

          {/* Footer */}
          <div className="font-mono text-xs text-white/30 uppercase tracking-wider">
            v0.1 · Mayo 2026
          </div>
        </div>
      </div>

      {/* Lado derecho - Formulario */}
      <div className="flex items-center justify-center p-8 lg:p-12 bg-background">
        <div className="w-full max-w-sm">
          {/* Logo móvil */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
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

          {/* Encabezado del form */}
          <div className="mb-8">
            <div className="text-photocan-amber font-mono text-xs uppercase tracking-widest mb-3">
              · Acceso
            </div>
            <h2 className="text-3xl font-semibold tracking-tight mb-2">
              Bienvenido
            </h2>
            <p className="text-muted-foreground text-sm">
              Ingresa tus credenciales para acceder al sistema.
            </p>
          </div>

          <LoginForm />

          <div className="mt-8 text-xs text-muted-foreground font-mono text-center">
            ¿Problemas para acceder? Contacta a tu administrador.
          </div>
        </div>
      </div>
    </div>
  );
}

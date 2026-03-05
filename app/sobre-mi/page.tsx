import Link from 'next/link'

export default function SobreMiPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-navy via-navy-dark to-teal-700 py-28 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-96 h-96 bg-cyan rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 left-10 w-80 h-80 bg-azure rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
            Mi historia
          </h1>
          <p className="text-xl md:text-2xl text-slate-light leading-relaxed max-w-3xl mx-auto">
            Más de una década litigando, enseñando y defendiendo lo que es justo.
          </p>
        </div>
      </section>

      {/* Sección 1 — Donde todo empezó */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-8">
            Donde todo empezó
          </h2>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Antes de graduarme, ya llevaba más de ocho años trabajando expedientes judiciales, día a día. Mi vida se enfocó en estudiar Derecho Civil, Derecho Mercantil y Derecho Procesal Civil. Fue ahí donde descubrí lo que se convertiría en mi principal fortaleza: el litigio civil.
          </p>
          <p className="text-lg text-slate leading-relaxed">
            Lo que me apasionó desde el principio fue la diversidad. Hay muchos tipos de juicios y todos son distintos. La estructura varía, las actitudes de las partes son impredecibles y cada caso exige un análisis profundo de todos los escenarios posibles. Esa complejidad me enganchó y nunca me soltó.
          </p>
        </div>
      </section>

      {/* Sección 2 — El Derecho Constitucional */}
      <section className="py-20 bg-slate-lighter">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-8">
            El Derecho Constitucional
          </h2>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Después llegó el Derecho Procesal Constitucional: amparos, inconstitucionalidades generales y parciales. Confieso que al inicio se me partió el cerebro tratando de entender la diferencia entre una Inconstitucionalidad General y una Parcial. Pero me enamoré de esta rama porque va más allá de lo superficial. Se trata de interpretar garantías constitucionales, analizar jurisprudencia e incorporar Convenciones y Tratados Internacionales en la argumentación.
          </p>
          <p className="text-lg text-slate leading-relaxed">
            Me costó mucho esfuerzo aprenderlo, pero lo aplicaba todos los días y lo perfeccioné en noveno semestre. Esa disciplina de estudio constante me dio una base que hasta hoy marca la diferencia en cada caso que llevo.
          </p>
        </div>
      </section>

      {/* Sección 3 — La experiencia penal */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-8">
            La experiencia penal
          </h2>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Ya como abogada graduada, me especialicé en expedientes penales. Me destaqué bastante en ese ámbito y eso me dio reconocimiento profesional. Sin embargo, la realidad del sistema penal guatemalteco me decepcionó profundamente.
          </p>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Recuerdo un caso que me marcó. Denuncié a una persona que había ingresado a una granja, roto el cerco perimetral, metido un mototaxi y llenado el vehículo con el producto que la granja había sembrado, cuidado durante meses y estaba por cosechar. No era la primera vez: ya lo había hecho en tres ocasiones anteriores. Cuando llegó el momento de la audiencia, el juez resolvió que no había mérito para abrir juicio. Su argumento fue que los limones, al estar adheridos al árbol, tenían naturaleza jurídica de bienes inmuebles, y que por lo tanto no se configuraba el delito de hurto, que requiere la apropiación de bienes muebles.
          </p>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Como si eso no fuera suficiente, la Fiscalía tampoco quería imputar el delito porque según su valoración, la cantidad de limones incautados no superaba los cien quetzales. Les expliqué que cada limón se vende a un quetzal con diez centavos y que eran varios cientos los que llevaba en el mototaxi. La Fiscal insistió en que mil limones en el mercado mayorista se consiguen por cien quetzales. Le respondí que ella no tenía facultad para decidir el valor de mi producto.
          </p>
          <p className="text-lg text-slate leading-relaxed">
            Apelé la resolución del juez y gané. El imputado fue juzgado y sentenciado por hurto agravado. Pero esa experiencia confirmó lo que ya intuía: el proceso penal en Guatemala tiene serias deficiencias. A diferencia del mundo civil, donde existen procesos ordinarios, orales, sumarios y ejecuciones especiales, cada uno con su propia estructura y complejidad, el proceso penal me resulta limitado en su diseño. Opté por dedicarle solo lo necesario a esa materia y concentrar mi energía donde realmente puedo hacer la diferencia.
          </p>
        </div>
      </section>

      {/* Sección 4 — Alcance internacional */}
      <section className="py-20 bg-slate-lighter">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-8">
            Alcance internacional
          </h2>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Mi ejercicio profesional ha trascendido las fronteras guatemaltecas. He llevado expedientes ante la Corte Interamericana de Derechos Humanos y otras instancias internacionales, representando a clientes guatemaltecos en casos derivados de juicios que inicié en el país.
          </p>
          <p className="text-lg text-slate leading-relaxed">
            Esta experiencia internacional complementa mi labor como profesora universitaria de Derecho Internacional Público, donde comparto con mis estudiantes no solo la teoría sino la vivencia real de litigar en foros internacionales.
          </p>
        </div>
      </section>

      {/* Sección 5 — Hoy */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-8">
            Hoy
          </h2>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Hoy dirijo mi despacho como un estudio jurídico boutique. No trabajamos en masa. Cada caso recibe atención personalizada porque ante la ley, los abogados y notarios cargamos con una responsabilidad enorme cuando cometemos errores. Esa responsabilidad la tomo en serio.
          </p>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Contamos con un equipo de trabajo especializado en derecho empresarial, contratos, derecho corporativo, litigios comerciales y procedimientos legales para emprendedores y empresas guatemaltecas. Nuestro enfoque es la calidad, no la cantidad.
          </p>
          <p className="text-lg text-slate leading-relaxed">
            Mi forma de trabajar siempre ha sido la misma: entender el problema a fondo, analizar todos los escenarios y pelear cada caso con la preparación que merece. Si algo aprendí en más de una década de litigio es que no hay atajos. La diferencia está en el trabajo, el estudio y la convicción de que cada cliente merece una defensa seria.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-navy to-teal-700">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-8">
            Trabajemos juntos
          </h2>
          <Link
            href="/agendar"
            className="inline-block px-10 py-4 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white transition-all duration-300 hover:shadow-lg text-lg"
          >
            Agenda una consulta
          </Link>
        </div>
      </section>
    </div>
  )
}

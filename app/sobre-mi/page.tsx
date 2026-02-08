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
            Mas de una decada litigando, ensenando y defendiendo lo que es justo.
          </p>
        </div>
      </section>

      {/* Seccion 1 — Donde todo empezo */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-8">
            Donde todo empezo
          </h2>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Antes de graduarme, ya llevaba mas de ocho anos trabajando expedientes judiciales, dia a dia. Mi vida se enfoco en estudiar Derecho Civil, Derecho Mercantil y Derecho Procesal Civil. Fue ahi donde descubri lo que se convertiria en mi principal fortaleza: el litigio civil.
          </p>
          <p className="text-lg text-slate leading-relaxed">
            Lo que me apasiono desde el principio fue la diversidad. Hay muchos tipos de juicios y todos son distintos. La estructura varia, las actitudes de las partes son impredecibles y cada caso exige un analisis profundo de todos los escenarios posibles. Esa complejidad me engancho y nunca me solto.
          </p>
        </div>
      </section>

      {/* Seccion 2 — El Derecho Constitucional */}
      <section className="py-20 bg-slate-lighter">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-8">
            El Derecho Constitucional
          </h2>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Despues llego el Derecho Procesal Constitucional: amparos, inconstitucionalidades generales y parciales. Confieso que al inicio se me partio el cerebro tratando de entender la diferencia entre una Inconstitucionalidad General y una Parcial. Pero me enamore de esta rama porque va mas alla de lo superficial. Se trata de interpretar garantias constitucionales, analizar jurisprudencia e incorporar Convenciones y Tratados Internacionales en la argumentacion.
          </p>
          <p className="text-lg text-slate leading-relaxed">
            Me costo mucho esfuerzo aprenderlo, pero lo aplicaba todos los dias y lo perfeccione en noveno semestre. Esa disciplina de estudio constante me dio una base que hasta hoy marca la diferencia en cada caso que llevo.
          </p>
        </div>
      </section>

      {/* Seccion 3 — La experiencia penal */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-8">
            La experiencia penal
          </h2>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Ya como abogada graduada, me especialice en expedientes penales. Me destaque bastante en ese ambito y eso me dio reconocimiento profesional. Sin embargo, la realidad del sistema penal guatemalteco me decepciono profundamente.
          </p>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Recuerdo un caso que me marco. Denuncie a una persona que habia ingresado a una granja, roto el cerco perimetral, metido un mototaxi y llenado el vehiculo con el producto que la granja habia sembrado, cuidado durante meses y estaba por cosechar. No era la primera vez: ya lo habia hecho en tres ocasiones anteriores. Cuando llego el momento de la audiencia, el juez resolvio que no habia merito para abrir juicio. Su argumento fue que los limones, al estar adheridos al arbol, tenian naturaleza juridica de bienes inmuebles, y que por lo tanto no se configuraba el delito de hurto, que requiere la apropiacion de bienes muebles.
          </p>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Como si eso no fuera suficiente, la Fiscalia tampoco queria imputar el delito porque segun su valoracion, la cantidad de limones incautados no superaba los cien quetzales. Les explique que cada limon se vende a un quetzal con diez centavos y que eran varios cientos los que llevaba en el mototaxi. La Fiscal insistio en que mil limones en el mercado mayorista se consiguen por cien quetzales. Le respondi que ella no tenia facultad para decidir el valor de mi producto.
          </p>
          <p className="text-lg text-slate leading-relaxed">
            Apele la resolucion del juez y gane. El imputado fue juzgado y sentenciado por hurto agravado. Pero esa experiencia confirmo lo que ya intuia: el proceso penal en Guatemala tiene serias deficiencias. A diferencia del mundo civil, donde existen procesos ordinarios, orales, sumarios y ejecuciones especiales, cada uno con su propia estructura y complejidad, el proceso penal me resulta limitado en su diseno. Opte por dedicarle solo lo necesario a esa materia y concentrar mi energia donde realmente puedo hacer la diferencia.
          </p>
        </div>
      </section>

      {/* Seccion 4 — Alcance internacional */}
      <section className="py-20 bg-slate-lighter">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-8">
            Alcance internacional
          </h2>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Mi ejercicio profesional ha trascendido las fronteras guatemaltecas. He llevado expedientes ante la Corte Interamericana de Derechos Humanos y otras instancias internacionales, representando a clientes guatemaltecos en casos derivados de juicios que inicie en el pais.
          </p>
          <p className="text-lg text-slate leading-relaxed">
            Esta experiencia internacional complementa mi labor como profesora universitaria de Derecho Internacional Publico, donde comparto con mis estudiantes no solo la teoria sino la vivencia real de litigar en foros internacionales.
          </p>
        </div>
      </section>

      {/* Seccion 5 — Hoy */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-8">
            Hoy
          </h2>
          <p className="text-lg text-slate leading-relaxed mb-6">
            Hoy dirijo Amanda Santizo y Asociados, un bufete con cinco abogados que maneja aproximadamente doscientos casos activos. Nos especializamos en derecho empresarial, contratos, derecho corporativo, litigios comerciales y procedimientos legales para emprendedores y empresas guatemaltecas.
          </p>
          <p className="text-lg text-slate leading-relaxed">
            Mi enfoque siempre ha sido el mismo: entender el problema a fondo, analizar todos los escenarios y pelear cada caso con la preparacion que merece. Si algo aprendi en mas de una decada de litigio es que no hay atajos. La diferencia esta en el trabajo, el estudio y la conviccion de que cada cliente merece una defensa seria.
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

import { context, propagation, trace, type Attributes, type Context, type Span, type Tracer } from '@opentelemetry/api'

export interface TraceCarrier {
  traceparent?: string
  tracestate?: string
}

export interface TraceContextMetadata {
  traceId: string
  spanId: string
}

export class WenyanTracer {
  private readonly tracer: Tracer

  constructor(name = '@andrey-kokoev/wenyan-censorate') {
    this.tracer = trace.getTracer(name)
  }

  startSpan(name: string, attributes: Attributes = {}): Span {
    const span = this.tracer.startSpan(name)
    span.setAttributes(attributes)
    return span
  }

  async withSpan<T>(name: string, attributes: Attributes, run: (span: Span) => Promise<T> | T): Promise<T> {
    const span = this.startSpan(name, attributes)
    try {
      const result = await run(span)
      return result
    } catch (error) {
      span.recordException(error as Error)
      throw error
    } finally {
      span.end()
    }
  }

  injectTraceContext(ctx?: Context): TraceCarrier {
    const carrier: TraceCarrier = {}
    propagation.inject(ctx ?? context.active(), carrier)
    return carrier
  }

  extractTraceContext(carrier: TraceCarrier): Context {
    return propagation.extract(context.active(), carrier)
  }

  currentTrace(): TraceContextMetadata | undefined {
    const span = trace.getSpan(context.active())
    if (!span) return undefined
    const sc = span.spanContext()
    return { traceId: sc.traceId, spanId: sc.spanId }
  }
}

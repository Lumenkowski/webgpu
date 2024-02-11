const canvas: HTMLCanvasElement = document.getElementById( "webgpu" )! as HTMLCanvasElement

let gpuDevice: GPUDevice | null = null

init()

async function init(): Promise<boolean> {

	if ( !( "gpu" in navigator ) ) {

		console.error( "Your browser does not support WebGPU." )

		return false
	}

	const gpuAdapter: GPUAdapter | null = await navigator.gpu.requestAdapter()

	if ( gpuAdapter === null ) {

		console.log( "We couldn't find any available WebGPU adapters." )

		return false
	}

	gpuDevice = await gpuAdapter.requestDevice()

	gpuDevice.lost.then( ( info: GPUDeviceLostInfo ) => {

		console.error( "WebGPU device was lost. Reason:", info.message )

		gpuDevice = null

		if ( info.reason !== "destroyed" ) {

			init()
		}
	} )

	onInit()

	return true
}

function onInit(): void {

	if ( gpuDevice === null ) {

		return
	}

	const gpuCanvasContext: GPUCanvasContext = canvas.getContext( "webgpu" )!

	const gpuTextureFormat: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat()

	gpuCanvasContext.configure( {
		device: gpuDevice,
		format: gpuTextureFormat,
		alphaMode: "premultiplied",
	} )

	const vertexWGSL = `

		@vertex fn main(

			@location( 0 ) vertices: vec2f

		) -> @builtin( position ) vec4f {

			return vec4f( vertices, 0, 1 );
		}
	`

	const fragmentWGSL = `

		@fragment fn main() -> @location( 0 ) vec4 <f32> {

			return vec4( 1.0, 1.0, 1.0, 1.0 );
		}
	`

	const vertices = new Float32Array( [
		+ 0.0, - 0.5,
		+ 0.5, + 0.5,
		- 0.5, + 0.5,
	] )

	const gpuVertexBuffer: GPUBuffer = gpuDevice.createBuffer( {
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	} )

	gpuDevice.queue.writeBuffer( gpuVertexBuffer, /* bufferOffset */ 0, vertices )

	const vertexBufferLayout: GPUVertexBufferLayout = {
		arrayStride: 8,
		attributes: [ {
			format: "float32x2",
			offset: 0,
			shaderLocation: 0, // Position, see vertex shader
		} ],
	}

	const gpuRenderPipeline: GPURenderPipeline = gpuDevice.createRenderPipeline( {
		layout: "auto",
		vertex: {
			module: gpuDevice.createShaderModule( {
				code: vertexWGSL,
			} ),
			entryPoint: "main",
			buffers: [ vertexBufferLayout, ],
		},
		fragment: {
			module: gpuDevice.createShaderModule( {
				code: fragmentWGSL,
			} ),
			entryPoint: "main",
			targets: [
				{
					format: gpuTextureFormat,
				},
			],
		},
		primitive: {
			topology: "triangle-list",
		},
		multisample: {
			count: 4,
		},
	} )

	let renderTarget: GPUTexture | undefined = undefined
	let renderTargetView: GPUTextureView

	const render = (): void => {

		if ( gpuDevice === null ) {

			return
		}

		const gpuCommandEncoder: GPUCommandEncoder | undefined = gpuDevice.createCommandEncoder()

		if ( gpuCommandEncoder === undefined ) {

			return
		}

		const currentWidth = canvas.clientWidth * devicePixelRatio
		const currentHeight = canvas.clientHeight * devicePixelRatio

		if ( currentWidth && currentHeight && ( currentWidth !== canvas.width || currentHeight !== canvas.height ) ) {

			if ( renderTarget !== undefined ) {

				// Destroy the previous render target

				renderTarget.destroy()
			}

			canvas.width = currentWidth
			canvas.height = currentHeight

			renderTarget = gpuDevice.createTexture( {
				size: [ canvas.width, canvas.height ],
				sampleCount: 4,
				format: gpuTextureFormat,
				usage: GPUTextureUsage.RENDER_ATTACHMENT,
			} )

			renderTargetView = renderTarget.createView()
		}

		if ( renderTargetView === undefined ) {

			return
		}

		const gpuRenderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: renderTargetView,
					resolveTarget: gpuCanvasContext.getCurrentTexture().createView(),
					clearValue: {
						r: 0,
						g: 0,
						b: 0,
						a: 1,
					},
					loadOp: "clear",
					storeOp: "store",
				},
			],
		}

		const gpuRenderPassEncoder: GPURenderPassEncoder = gpuCommandEncoder.beginRenderPass( gpuRenderPassDescriptor )

		gpuRenderPassEncoder.setPipeline( gpuRenderPipeline )
		gpuRenderPassEncoder.setVertexBuffer( 0, gpuVertexBuffer )
		gpuRenderPassEncoder.draw( vertices.length / 2 )
		gpuRenderPassEncoder.end()

		gpuDevice.queue.submit( [ gpuCommandEncoder.finish() ] )

		window.requestAnimationFrame( render )
	}

	window.requestAnimationFrame( render )
}

export {}

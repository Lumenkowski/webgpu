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

	canvas.width = window.innerWidth
	canvas.height = window.innerHeight

	const gpuTextureFormat: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat()

	gpuCanvasContext.configure( {
		device: gpuDevice,
		format: gpuTextureFormat,
		alphaMode: "premultiplied",
	} )

	const vertexWGSL = `

		@vertex fn main(

			@builtin( vertex_index ) VertexIndex : u32

		) -> @builtin( position ) vec4 <f32> {

			var pos = array <vec2 <f32>, 3> (
				vec2( 0.0, - 0.5 ),
				vec2( 0.5, 0.5 ),
				vec2( - 0.5, 0.5 ),
			);

			return vec4 <f32> ( pos[ VertexIndex ], 0.0, 1.0 );
		}
	`

	const fragmentWGSL = `

		@fragment fn main() -> @location( 0 ) vec4 <f32> {

			return vec4( 1.0, 1.0, 1.0, 1.0 );
		}
	`

	const gpuRenderPipeline: GPURenderPipeline = gpuDevice.createRenderPipeline( {
		layout: "auto",
		vertex: {
			module: gpuDevice.createShaderModule( {
				code: vertexWGSL,
			} ),
			entryPoint: "main",
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

	const gpuTexture: GPUTexture = gpuDevice.createTexture( {
		size: [ canvas.width, canvas.height ],
		sampleCount: 4,
		format: gpuTextureFormat,
		usage: GPUTextureUsage.RENDER_ATTACHMENT,
	} )

	const gpuTextureView: GPUTextureView = gpuTexture.createView()

	const render = (): void => {

		if ( gpuDevice === null ) {

			return
		}

		const gpuCommandEncoder: GPUCommandEncoder | undefined = gpuDevice.createCommandEncoder()

		if ( gpuCommandEncoder === undefined ) {

			return
		}

		const gpuRenderPassDescriptor: GPURenderPassDescriptor = {
			colorAttachments: [
				{
					view: gpuTextureView,
					resolveTarget: gpuCanvasContext.getCurrentTexture().createView(),
					clearValue: {
						r: 0,
						g: 0,
						b: 0,
						a: 1,
					},
					loadOp: "clear",
					storeOp: "discard",
				},
			],
		}

		const gpuRenderPassEncoder: GPURenderPassEncoder = gpuCommandEncoder.beginRenderPass( gpuRenderPassDescriptor )

		gpuRenderPassEncoder.setPipeline( gpuRenderPipeline )
		gpuRenderPassEncoder.draw( 3 )
		gpuRenderPassEncoder.end()

		gpuDevice.queue.submit( [ gpuCommandEncoder.finish() ] )

		window.requestAnimationFrame( render )
	}

	window.requestAnimationFrame( render )
}

export {}

// lib/nail/shaders/skin-sss.wgsl
// Biophysical Skin Inversion Shader (Spectral SSS) · Dr. Nina

struct Uniforms {
    lightPos: vec3<f32>,
    viewPos: vec3<f32>,
    melaninFraction: f32,
    haemoglobinFraction: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var baseTexture: texture_2d<f32>;
@group(0) @binding(2) var textureSampler: sampler;

@fragment
fn main(
    @location(0) vUv: vec2<f32>,
    @location(1) vNormal: vec3<f32>,
    @location(2) vPosition: vec3<f32>,
) -> @location(0) vec4<f32> {
    let albedo = textureSample(baseTexture, textureSampler, vUv).rgb;

    let N = normalize(vNormal);
    let L = normalize(uniforms.lightPos - vPosition);
    let V = normalize(uniforms.viewPos - vPosition);

    let NoL = max(dot(N, L), 0.0);
    let diffuse = albedo * NoL;

    // Spectral SSS approximation — red scatters deeper than blue
    let scatterDepth = vec3<f32>(3.67, 1.37, 0.68);
    let sssProfile = exp(-scatterDepth * (1.0 - NoL) * 2.0);

    let melaninAbsorb = vec3<f32>(0.9, 0.6, 0.3) * uniforms.melaninFraction;
    let bloodAbsorb = vec3<f32>(0.2, 0.9, 0.8) * uniforms.haemoglobinFraction;

    // Soft specular lobe for wet-looking clinical skin
    let H = normalize(L + V);
    let NoH = max(dot(N, H), 0.0);
    let spec = pow(NoH, 48.0) * 0.18;

    let skinColor = (diffuse + (sssProfile * 0.4) + vec3<f32>(spec)) * (1.0 - melaninAbsorb) * (1.0 - bloodAbsorb);

    return vec4<f32>(skinColor, 1.0);
}

// One custom lens pass: fisheye (barrel), colour fringing, vignette, grain, optional peephole circle.
export const LensShader = {
  uniforms: {
    tDiffuse: { value: null }, uAspect: { value: 1080 / 1920 },
    uFish: { value: 0 }, uChroma: { value: 0.0025 }, uVig: { value: 0.55 }, uGrain: { value: 0.06 },
    uSeed: { value: 0 }, uCircle: { value: 0 }, uFlash: { value: 0 }, uLift: { value: 0.012 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAspect, uFish, uChroma, uVig, uGrain, uSeed, uCircle, uFlash, uLift;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
    vec2 warp(vec2 uv, float k){
      vec2 p = uv*2.0-1.0; p.x *= uAspect;
      float r2 = dot(p,p) / max(1.0, uAspect*uAspect);   // same lens on 9:16 and 16:9
      p *= (1.0 + k*r2) / (1.0 + k*0.6);
      p.x /= uAspect; return p*0.5+0.5;
    }
    void main(){
      vec2 p = vUv*2.0-1.0; p.x *= uAspect; float r = length(p) / max(1.0, uAspect);
      float ca = uChroma * (0.4 + r*r);
      vec3 col;
      col.r = texture2D(tDiffuse, warp(vUv, uFish + ca*8.0)).r;
      col.g = texture2D(tDiffuse, warp(vUv, uFish)).g;
      col.b = texture2D(tDiffuse, warp(vUv, uFish - ca*8.0)).b;
      col += uLift;                                    // keeps night shots from crushing to black
      col *= mix(1.0, smoothstep(1.45, 0.25, r), uVig);
      float g = hash(vUv*vec2(1600.0,1600.0) + uSeed*13.17) - 0.5;
      col += g*uGrain;
      if (uCircle > 0.0) {
        vec2 q = vUv*2.0-1.0; q.x *= uAspect; q.y -= (uAspect > 1.0 ? 0.0 : 0.06);
        float d = length(q);
        float rim = smoothstep(uCircle-0.05, uCircle, d) * (1.0 - smoothstep(uCircle, uCircle+0.012, d));
        col *= smoothstep(uCircle+0.004, uCircle-0.03, d);
        col += vec3(0.55,0.45,0.3)*rim*0.25;
      }
      col = mix(col, vec3(1.0,0.97,0.92), uFlash);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

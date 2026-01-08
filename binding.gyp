{
  "targets": [
    {
      "target_name": "faiss_node",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [
        "src/cpp/faiss_index.cpp",
        "src/cpp/napi_bindings.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "/opt/homebrew/include",
        "/usr/local/include"
      ],
      "defines": [
        "NAPI_VERSION=8"
      ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "OTHER_CPLUSPLUSFLAGS": [
              "-std=c++17",
              "-fexceptions",
              "-frtti"
            ]
          },
          "libraries": [
            "-L/opt/homebrew/lib",
            "-L/usr/local/lib",
            "-L/opt/homebrew/Cellar/openblas/0.3.30/lib",
            "-lfaiss",
            "-lopenblas"
          ],
          "ldflags": [
            "-L/opt/homebrew/lib",
            "-L/opt/homebrew/Cellar/openblas/0.3.30/lib"
          ]
        }]
      ],
      "cflags_cc": [
        "-std=c++17",
        "-fexceptions",
        "-frtti"
      ]
    }
  ]
}

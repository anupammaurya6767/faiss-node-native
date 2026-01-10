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
        "src/cpp",
        "/opt/homebrew/include",
        "/usr/local/include",
        "/usr/include"
      ],
      "defines": [
        "NAPI_VERSION=8"
      ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "11.0",
            "OTHER_CPLUSPLUSFLAGS": [
              "-std=c++17",
              "-fexceptions",
              "-frtti"
            ],
            "OTHER_LDFLAGS": [
              "-headerpad_max_install_names"
            ]
          },
          "libraries": [
            "-L/opt/homebrew/lib",
            "-L/usr/local/lib",
            "-L/opt/homebrew/opt/libomp/lib",
            "-L/usr/local/opt/libomp/lib",
            "-L/opt/homebrew/Cellar/openblas/0.3.30/lib",
            "-lfaiss",
            "-lopenblas",
            "-lomp"
          ],
          "ldflags": [
            "-L/opt/homebrew/lib",
            "-L/usr/local/lib",
            "-L/opt/homebrew/opt/libomp/lib",
            "-L/usr/local/opt/libomp/lib",
            "-L/opt/homebrew/Cellar/openblas/0.3.30/lib",
            "-headerpad_max_install_names"
          ]
        }],
        ["OS=='linux'", {
          "include_dirs": [
            "<!@(node -p \"require('node-addon-api').include\")",
            "src/cpp",
            "/usr/local/include",
            "/usr/include"
          ],
          "libraries": [
            "-L/usr/local/lib",
            "-L/usr/lib",
            "-lfaiss",
            "-lopenblas",
            "-lgomp"
          ],
          "ldflags": [
            "-L/usr/local/lib",
            "-L/usr/lib",
            "-Wl,-rpath,/usr/local/lib:/usr/lib/x86_64-linux-gnu"
          ],
          "cflags_cc": [
            "-std=c++17",
            "-fexceptions",
            "-frtti",
            "-fopenmp",
            "-I/usr/local/include"
          ]
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": [
                "/std:c++17",
                "/EHsc"
              ]
            }
          },
          "msvs_precompiled_header": "",
          "include_dirs": [
            "<!@(node -p \"require('node-addon-api').include\")",
            "src/cpp",
            "C:/faiss-install/include"
          ],
          "libraries": [
            "faiss.lib",
            "openblas.lib",
            "libomp.lib"
          ],
          "library_dirs": [
            "C:/faiss-install/lib"
          ],
          "cflags_cc": [
            "/std:c++17",
            "/EHsc"
          ],
          "conditions": [
            ["target_arch=='x64'", {
              "msvs_configuration_platform": "x64"
            }]
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

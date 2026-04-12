{
  "targets": [
    {
      "target_name": "faiss_node",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [
        "src/cpp/faiss_index.cpp",
        "src/cpp/faiss_binary_index.cpp",
        "src/cpp/napi_bindings.cpp",
        "src/cpp/napi_binary_bindings.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "src/cpp",
        "/opt/homebrew/include",
        "/opt/homebrew/opt/faiss/include",
        "/opt/homebrew/opt/openblas/include",
        "/opt/homebrew/opt/libomp/include",
        "/usr/local/include",
        "/usr/local/opt/faiss/include",
        "/usr/local/opt/openblas/include",
        "/usr/local/opt/libomp/include",
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
            "-L/opt/homebrew/opt/faiss/lib",
            "-L/usr/local/opt/faiss/lib",
            "-L/opt/homebrew/opt/openblas/lib",
            "-L/usr/local/opt/openblas/lib",
            "-lfaiss",
            "-lopenblas",
          ],
          "ldflags": [
            "-L/opt/homebrew/lib",
            "-L/usr/local/lib",
            "-L/opt/homebrew/opt/faiss/lib",
            "-L/usr/local/opt/faiss/lib",
            "-L/opt/homebrew/opt/openblas/lib",
            "-L/usr/local/opt/openblas/lib",
            "-Wl,-rpath,/opt/homebrew/opt/faiss/lib",
            "-Wl,-rpath,/usr/local/opt/faiss/lib",
            "-Wl,-rpath,/opt/homebrew/opt/openblas/lib",
            "-Wl,-rpath,/usr/local/opt/openblas/lib",
            "-headerpad_max_install_names"
          ]
        }],
        ["OS=='linux'", {
          "include_dirs": [
            "<!@(node -p \"require('node-addon-api').include\")",
            "src/cpp",
            "/usr/local/cuda/include",
            "/usr/local/cuda/targets/x86_64-linux/include",
            "/usr/local/include",
            "/usr/include"
          ],
          "libraries": [
            "-L/usr/local/lib",
            "-L/usr/lib",
            "<!@(bash -lc 'for dir in /usr/local/cuda/lib64 /usr/local/cuda/targets/x86_64-linux/lib; do if [ -d \"$dir\" ]; then printf -- \"-L%s\\n\" \"$dir\"; fi; done')",
            "-lfaiss",
            "-lopenblas",
            "-lgomp",
            "<!@(bash -lc 'if [ -e /usr/local/cuda/lib64/libcudart.so ] || [ -e /usr/local/cuda/targets/x86_64-linux/lib/libcudart.so ]; then printf -- \"-lcudart\\n\"; fi; if [ -e /usr/local/cuda/lib64/libcublas.so ] || [ -e /usr/local/cuda/targets/x86_64-linux/lib/libcublas.so ]; then printf -- \"-lcublas\\n\"; fi')"
          ],
          "ldflags": [
            "-L/usr/local/lib",
            "-L/usr/lib",
            "-Wl,-rpath,/usr/local/lib:/usr/lib/x86_64-linux-gnu:/usr/local/cuda/lib64:/usr/local/cuda/targets/x86_64-linux/lib"
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

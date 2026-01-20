import os

file_path = "sound-txt/7_Difficullt_Clients_i_ve_dealt_with_final_01.mp3"
chunk_size = 5 * 1024 * 1024 # 5MB

with open(file_path, 'rb') as f:
    part_num = 1
    while True:
        chunk = f.read(chunk_size)
        if not chunk:
            break
        output_path = f"sound-txt/7_Difficullt_Clients_small_part{part_num}.mp3"
        with open(output_path, 'wb') as out_f:
            out_f.write(chunk)
        print(f"Created {output_path}")
        part_num += 1

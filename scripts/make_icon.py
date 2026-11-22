import math

width, height = 1024, 1024
pixels = bytearray(width * height * 3)

# Teal accent: (13, 148, 136) #0D9488
# Deep navy: (30, 41, 59) #1E293B
# Background: transparent/off-white (248, 250, 251)

corner_radius = 220
center_x, center_y = 512, 512

def in_rounded_rect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    # Check 4 corners
    if x < x0 + r and y < y0 + r:
        return (x - (x0 + r))**2 + (y - (y0 + r))**2 <= r**2
    if x > x1 - r and y < y0 + r:
        return (x - (x1 - r))**2 + (y - (y0 + r))**2 <= r**2
    if x < x0 + r and y > y1 - r:
        return (x - (x0 + r))**2 + (y - (y1 - r))**2 <= r**2
    if x > x1 - r and y > y1 - r:
        return (x - (x1 - r))**2 + (y - (y1 - r))**2 <= r**2
    return True

# Draw
for y in range(height):
    for x in range(width):
        idx = (y * width + x) * 3
        # Squircle icon container
        if in_rounded_rect(x, y, 64, 64, 960, 960, corner_radius):
            # Gradient from deep teal to dark navy
            t = (x + y) / (2048.0)
            r = int(13 * (1 - t) + 15 * t)
            g = int(148 * (1 - t) + 23 * t)
            b = int(136 * (1 - t) + 42 * t)

            # Draw white shopping cart / storefront
            # Cart basket: x in [320, 720], y in [380, 580]
            # Handle: line from (240, 320) to (320, 380)
            # Wheels: circles at (420, 680) and (640, 680), radius 45
            in_wheel_1 = (x - 420)**2 + (y - 680)**2 <= 45**2
            in_wheel_2 = (x - 640)**2 + (y - 680)**2 <= 45**2
            in_wheel_hub_1 = (x - 420)**2 + (y - 680)**2 <= 20**2
            in_wheel_hub_2 = (x - 640)**2 + (y - 680)**2 <= 20**2

            # Cart basket lines
            in_basket_top = (320 <= x <= 720) and (380 <= y <= 405)
            in_basket_bottom = (360 <= x <= 680) and (555 <= y <= 580)
            # Slanted sides
            # Left side: from (320, 380) to (360, 580)
            in_basket_left = (380 <= y <= 580) and abs(x - (320 + (y - 380) * 40 / 200)) <= 14
            # Right side: from (720, 380) to (680, 580)
            in_basket_right = (380 <= y <= 580) and abs(x - (720 - (y - 380) * 40 / 200)) <= 14
            # Grid bars inside cart
            in_grid_h = (345 <= x <= 695) and (465 <= y <= 485)
            in_grid_v1 = (435 <= x <= 455) and (395 <= y <= 565)
            in_grid_v2 = (545 <= x <= 565) and (395 <= y <= 565)
            in_grid_v3 = (635 <= x <= 655) and (395 <= y <= 565)

            # Handle bar: from (240, 320) to (320, 380)
            in_handle = False
            if 300 <= y <= 385:
                expected_x = 220 + (y - 300) * (100 / 80)
                if abs(x - expected_x) <= 14:
                    in_handle = True

            # Cart chassis: from (360, 580) to (680, 580) down to wheels
            in_chassis = (360 <= x <= 680) and (600 <= y <= 620)

            is_white = (
                (in_wheel_1 and not in_wheel_hub_1) or
                (in_wheel_2 and not in_wheel_hub_2) or
                in_basket_top or in_basket_bottom or in_basket_left or in_basket_right or
                in_grid_h or in_grid_v1 or in_grid_v2 or in_grid_v3 or in_handle or in_chassis
            )

            if is_white:
                pixels[idx] = 255
                pixels[idx + 1] = 255
                pixels[idx + 2] = 255
            else:
                pixels[idx] = max(0, min(255, r))
                pixels[idx + 1] = max(0, min(255, g))
                pixels[idx + 2] = max(0, min(255, b))
        else:
            # White background
            pixels[idx] = 255
            pixels[idx + 1] = 255
            pixels[idx + 2] = 255

with open('/tmp/room314_icon.ppm', 'wb') as f:
    f.write(f'P6\n{width} {height}\n255\n'.encode('ascii'))
    f.write(pixels)

print('PPM icon written successfully.')


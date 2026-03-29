# Hotel Booking Localhost Setup (Laragon + MySQL + PHP)

## 1. Create database schema
1. Open phpMyAdmin (Laragon).
2. Import `database.sql` from this project root.
3. This creates database `hotel_booking` and seeds base data.

## 2. Configure DB credentials
Edit `api/_bootstrap.php` if your MySQL credentials differ:
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`

Default values are:
- host: `127.0.0.1`
- port: `3306`
- db: `hotel_booking`
- user: `root`
- pass: ``

## 3. Run project in Laragon
1. Ensure Apache + MySQL are running.
2. Open project in browser via Laragon URL, e.g.:
   - `http://hotel-booking.test/`
   - or `http://localhost/Hotel%20Booking/`

## 4. Default login
The API auto-creates an admin account on first auth request:
- Email: `admin@grandhorizon.com`
- Password: `admin123`

## 5. API endpoints created
- Auth:
  - `api/auth/login.php`
  - `api/auth/register.php`
  - `api/auth/logout.php`
  - `api/auth/me.php`
- Data:
  - `api/rooms.php`
  - `api/customers.php`
  - `api/bookings.php`
  - `api/settings.php`

## 6. Notes
- Frontend now uses PHP session auth + MySQL data, not localStorage.
- If you get `Unauthorized`, login again from `auth/login.html`.
- If API fails to connect, check DB config and Apache/PHP logs in Laragon.


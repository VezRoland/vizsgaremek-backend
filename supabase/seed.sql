SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: company; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."company" ("id", "name", "code", "created_at") VALUES
	('4ca390cd-5029-4eab-992e-372d3495c305', 'test company', '22222222', '2025-02-07 09:38:12.624968+00'),
	('47882b18-48cc-445a-a866-a4187ac9592e', 'asd', 'aaaaaaaa', '2025-02-07 09:41:28.817559+00'),
	('48907ba5-d2fd-43c6-9f76-ec71375d4bfa', 'eewrwerwer', 'ssssssss', '2025-02-07 09:45:48.05809+00'),
	('5d5a6ad6-e3f1-403a-af5f-f1fc38e34a0a', 'Test company', 'aaaaaaaa', '2025-02-20 14:16:49.402587+00'),
	('93f12f3e-8135-45f8-a7f3-be7f9aa88d92', 'Hello World!', '04ead84e', '2025-02-20 18:40:20.561788+00'),
	('cbe725c8-534a-478c-adbe-ccc5e828aade', 'Hello World!', '327f2849', '2025-02-20 18:40:39.063763+00'),
	('f9d5c1ef-c12f-49c8-845b-85a8ca370e0c', 'Hello World!', '4a353223', '2025-02-20 18:42:41.342853+00'),
	('4e0991a3-fe37-45cb-be9d-b35144523815', 'fdgrgrgregrg', '5e06c794', '2025-02-28 09:05:04.842788+00'),
	('a07453d4-85ed-4206-9ee3-f99fe4e1af73', 'Rózsa123', '73b5a58b', '2025-02-28 09:06:28.966699+00'),
	('c44dd8e1-697e-4b73-9109-432eb957f4d2', 'Asd', '82160324', '2025-02-28 09:14:06.453195+00'),
	('5f15ec92-2503-47a0-a1b2-9ade307809d0', 'John Doe''s Corporation', '2b97039b', '2025-04-11 18:55:18.096035+00'),
	('aa608bae-d5aa-40c8-936b-292d0ea6ce95', 'John Doe''s Corporation', '0b4100a7', '2025-04-11 18:56:07.267928+00'),
	('75194e18-ee5f-43fd-bbda-4c22a7827250', 'John Doe''s Corporation', '8c6428a6', '2025-04-11 18:56:22.505603+00'),
	('22d9d2e0-bad0-4873-aeb6-ede3f1e63b92', 'John Doe''s Corporation', 'e48b34b4', '2025-04-11 18:57:56.80571+00'),
	('14d88948-131c-4bd2-852f-b05eb07ce663', 'John Doe''s Corporation', '046758c8', '2025-04-11 19:00:07.310408+00'),
	('29618a5e-8cc0-4058-a38a-e9ab688702c7', 'John Doe''s Corporation', '6a57103f', '2025-04-11 19:00:23.021726+00'),
	('b500f964-27a1-4b3b-a796-d5f9795b29fb', 'John Doe Corporation', '83fcd41b', '2025-04-12 05:14:49.740082+00'),
	('426aa5a1-f859-4ad3-8953-3b8fd670ab1a', 'John Doe Corporation', 'a3b65367', '2025-04-12 05:14:50.920031+00'),
	('f9fd0d1e-d333-49f3-b44a-c597c7c80abd', 'John Doe Corporation', '587ad1fd', '2025-04-12 05:14:51.495644+00'),
	('901d32a1-13c7-4922-970c-beb0c1a186ae', 'John Doe Corporation', 'e4c8a169', '2025-04-12 05:14:51.643092+00'),
	('496a827f-e186-42dd-bc7f-4b1900d351f1', 'John Doe Corporation', 'effe1c25', '2025-04-12 05:14:51.79355+00'),
	('e9057b56-c4be-4a28-a531-b73555764e6a', 'John Doe Corporation', '0618ecee', '2025-04-12 05:14:51.933108+00'),
	('636d923c-9a7f-4468-9c31-5e9b1c687724', 'John Doe Corporation', 'cd2c40a8', '2025-04-12 05:14:52.105603+00'),
	('f2e659fd-7a2b-4990-be8e-df389283b2b0', 'John Doe Corporation', '50a3eff3', '2025-04-12 05:14:52.210802+00'),
	('995b4586-e552-4644-9a7d-f885a7036d53', 'John Doe Corporation', 'ca4c5ee0', '2025-04-12 05:14:52.343919+00'),
	('56f16f23-41bd-4f19-88f7-4e84ced1968d', 'John Doe Corporation', 'c09b6eec', '2025-04-12 05:14:52.46629+00'),
	('31062d29-fe63-439d-93d3-0c99ce19653b', 'John Doe Corporation', 'd37ac723', '2025-04-12 05:14:52.604586+00'),
	('d431f0b3-4f2b-4b50-8240-0e650f4298d5', 'John Doe Corporation', '1ccd9354', '2025-04-12 05:14:52.762523+00'),
	('c9091000-b081-4b54-a34a-68a97804661e', 'John Doe Corporation', 'f57e0aa9', '2025-04-12 05:14:52.87806+00'),
	('30c0f816-2349-4ad4-98a8-59cc3df22bd8', 'John Doe', 'e97b8f38', '2025-04-12 05:16:45.27757+00'),
	('997bc51f-7012-4685-b697-36c9afcc4cee', 'John Doe', '1e9d4231', '2025-04-12 05:18:56.219625+00'),
	('74361e66-2cad-4c78-9cbb-a29c2caf02d6', 'John Doe', 'a88ce202', '2025-04-12 05:19:36.062568+00'),
	('dabbc1dd-3949-4fd5-8457-d2c10e69e744', 'John Doe', 'b47a23f9', '2025-04-12 05:20:31.074754+00'),
	('a53c904f-d53a-4dd8-b145-4a733e9d46ba', 'John Doe', '4626ef84', '2025-04-12 05:20:48.57654+00'),
	('720fc4a0-ee15-4819-a6cd-601720baf672', 'John Doe', '4fd55b8a', '2025-04-12 05:20:49.364957+00'),
	('2d8a1ca5-0e0f-40ef-b723-4599dadcd59d', 'John Doe', '18f413ff', '2025-04-12 05:20:51.588667+00'),
	('b807fef2-1e25-45a6-8f00-d2b310b6c611', 'John Doe', 'd3bc1a0e', '2025-04-12 05:21:33.82363+00'),
	('5916ef99-7c59-40d5-b19d-081ae0a4674a', 'John Doe', '7caaf7f9', '2025-04-12 05:22:14.378811+00'),
	('2f4d562a-a502-434f-a5e6-320f9cb362fb', 'John Doe', '2200af17', '2025-04-12 05:25:43.160229+00'),
	('24de7058-c644-42ec-a6e5-d445b0bc97a6', 'John Doe', '28996f27', '2025-04-12 05:26:28.502108+00'),
	('c65d6f52-f93e-444e-83b8-900a26634e91', 'John Doe', '81fc3891', '2025-04-12 05:27:40.200124+00'),
	('82af125d-44ca-418d-a726-04a269d5899b', 'John Doe', 'a640ac2e', '2025-04-12 05:28:02.128083+00'),
	('ad58d219-589e-430a-aa3a-411324470918', 'John Doe', '1bfbfd89', '2025-04-12 05:30:50.01415+00'),
	('9f081fb8-d5f8-4080-8e55-bdd79d9161a7', 'John Doe', '8188d47e', '2025-04-12 05:31:35.543912+00'),
	('9cf95137-d32b-4a47-b3e7-c5c19da35e03', 'John Doe', '63165f62', '2025-04-12 05:32:36.375755+00'),
	('408345ea-edff-4c8b-b7b6-014b90cc74eb', 'John Doe', '1103e66c', '2025-04-12 05:32:47.501777+00'),
	('ac4962b0-437a-44a5-a4d3-54037f6648eb', 'John Doe', '0c108e26', '2025-04-12 05:32:48.947248+00'),
	('0b427f07-9577-4949-93ac-f0a6d650cabc', 'John Doe', '68d1da7a', '2025-04-12 05:33:05.32654+00'),
	('2edbc783-349b-4fee-8c5a-b897996b0247', 'John Doe', 'ee62b4f3', '2025-04-12 05:33:36.102584+00'),
	('95cb39ab-07ea-4eaa-8c95-9fa8ea3007fe', 'John Doe', 'a8e3f722', '2025-04-12 05:34:20.669258+00'),
	('f05b9ab3-ef1d-4f6d-aff1-6fa1d037c235', 'John Doe', '5330ac21', '2025-04-12 05:35:01.824466+00'),
	('920f0207-b9a2-485f-81f5-0e31e073b4b2', 'John Doe', '50b608b5', '2025-04-12 05:35:06.644408+00'),
	('ac562ea7-fd3a-4d7e-889e-1287f6dfb25c', 'John Doe', '3927d64d', '2025-04-12 05:35:31.33472+00'),
	('914ffe56-ad31-4dad-b7eb-2cc3fb995d4e', 'John Doe', '32b53b3e', '2025-04-12 05:37:29.343536+00'),
	('776f48c1-f83c-4d47-8f7c-3958a1b1d116', 'John Doe', '57cbf6c6', '2025-04-12 05:39:15.559896+00'),
	('10bb5b78-f2f1-499d-a702-a230765937ee', 'John Doe', '7d175b81', '2025-04-12 05:44:55.800477+00');


--
-- Data for Name: training; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."training" ("id", "name", "description", "file_url", "created_at", "role", "company_id", "questions") VALUES
	('a556a7ad-9b17-4ad5-b0a8-2ccf22416d48', 'asfgrsgsgsef', 'asefseesfa', 'trainings/47882b18-48cc-445a-a866-a4187ac9592e/129777ce-d7e5-41a4-8aed-a264f9fbc168.pdf', '2025-04-08 07:08:14.167824+00', 1, '47882b18-48cc-445a-a866-a4187ac9592e', '[{"id": "8b1afe91-bfb8-4d53-853c-d01690fb5b71", "name": "haa", "answers": [{"text": "hoo", "correct": false}, {"text": "hihi", "correct": false}, {"text": "heeeeeeeeeeeeeeeeeeeeeeeeee", "correct": true}], "multipleCorrect": false}]'),
	('160fbb3e-540a-4713-9a88-6e6cd371795a', 'regegegerger0', 'gbrtbrbtrbrrb', 'trainings/47882b18-48cc-445a-a866-a4187ac9592e/regegegerger0_160fbb3e-540a-4713-9a88-6e6cd371795a.pdf', '2025-04-09 12:22:49.516368+00', 1, '47882b18-48cc-445a-a866-a4187ac9592e', '[{"id": "c9f02e68-34d7-4926-a8b3-05d60662c45c", "name": "gfnghthhh45", "answers": [{"text": "grggg5g4gg", "correct": false}, {"text": "rgtggrg54g445g5", "correct": true}], "multipleCorrect": false}]'),
	('0fd1b684-97f8-46b7-8c52-08bd54fd4c5a', 'thrhrhtrhtrhrhhh', 'dfgdgfdgdfgrgddggrgd', 'trainings/47882b18-48cc-445a-a866-a4187ac9592e/thrhrhtrhtrhrhhh_0fd1b684-97f8-46b7-8c52-08bd54fd4c5a.pdf', '2025-04-09 12:34:51.776177+00', 1, '47882b18-48cc-445a-a866-a4187ac9592e', '[{"id": "c7ef1a39-c2b5-49bd-ba2e-76ec7ecf8b2f", "name": "gdgrregegegergre", "answers": [{"text": "fdfdgrgegdrgd", "correct": true}, {"text": "dfdgregegrg", "correct": false}], "multipleCorrect": false}]');


--
-- Data for Name: question; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user" ("id", "name", "age", "hourly_wage", "role", "company_id", "verified", "created_at", "avatar_url") VALUES
	('ba344fc7-bcb2-44e8-9618-16b21aef4189', 'dfsfsdfsdf', NULL, NULL, 3, NULL, false, '2025-02-21 07:47:01.395222+00', NULL),
	('d27a1a76-b54f-45d2-99c7-9a4f6e910fdd', 'sdxdfsfsdfds', NULL, NULL, 3, NULL, false, '2025-02-21 07:43:57.778037+00', NULL),
	('58fea5e0-9379-4ff0-833b-1cf153d5027e', 'sfdffsfdsfs', NULL, NULL, 3, NULL, false, '2025-02-21 07:47:27.497984+00', NULL),
	('08e15d81-2120-42de-8a8e-313417ac68ca', 'gfgdgfdgdfgd', NULL, NULL, 3, NULL, false, '2025-02-21 07:44:31.257205+00', NULL),
	('7bd700d7-fc8a-4bc7-9b5b-119188b8e0f8', 'dfsfsdfsdfdff', NULL, NULL, 3, NULL, false, '2025-02-21 07:49:23.010968+00', NULL),
	('8eddacc0-2f49-4ac5-91e4-44ea121bbf27', 'dfsdfdsfsdf', NULL, NULL, 3, NULL, false, '2025-02-21 07:46:31.771981+00', NULL),
	('11dbeb4f-1191-4ef0-ac0c-187367bd7cd0', 'Rózsavölgyi Zoltán', NULL, NULL, 3, NULL, false, '2025-02-28 09:06:28.56622+00', NULL),
	('ddb7cc48-15cf-428a-ba7a-280bff50a488', 'John Doe', NULL, NULL, 1, NULL, false, '2025-02-21 08:06:21.249946+00', NULL),
	('2990e8a8-3caa-4297-bcaf-b513e6e707bb', 'sss', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 08:00:05.917707+00', NULL),
	('8c0ad99a-3d89-4807-85f0-6170f80d189c', 'f', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:49:52.855259+00', NULL),
	('357956fb-b50b-4ca2-b7fd-1431a8b68e4a', 'w', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:54:40.326752+00', NULL),
	('cc331223-411c-4390-a6e0-6b4e0c80aea2', 'John Doe', NULL, NULL, 4, NULL, false, NULL, NULL),
	('80137d5d-9553-4495-846f-843b41a9095b', 'jjj', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:57:41.644683+00', NULL),
	('cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'Test User', NULL, NULL, 1, 'c44dd8e1-697e-4b73-9109-432eb957f4d2', false, '2025-03-03 07:44:29.709548+00', NULL),
	('8fc8de72-fecc-49f3-a8ff-51bba3f85ff8', 'g', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:50:05.186037+00', NULL),
	('a5cb0d83-d027-4cd4-bee3-3df8ccaa5858', 'x', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:54:48.45125+00', NULL),
	('13bb3b4a-64f4-44d5-809e-3127bc836e3f', 'John Doe', NULL, NULL, 3, 'ac562ea7-fd3a-4d7e-889e-1287f6dfb25c', false, '2025-04-12 05:35:31.461926+00', NULL),
	('b4996361-7cef-41ac-bd89-7dc073a2b21a', 'ttt', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 08:00:17.255148+00', NULL),
	('587ec5fc-9eb6-4390-8d25-acde09087d4f', 'i', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:51:38.964766+00', NULL),
	('3e52ad2c-50aa-4467-af03-4eb47eb9156c', 'kkk', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:57:58.479941+00', NULL),
	('361b5150-3697-4fee-a1da-ad425ebd4e94', 'y', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:55:01.325073+00', NULL),
	('ecd0a489-24a1-40c1-b1cd-69cc0332e902', 'j', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:51:49.130741+00', NULL),
	('3d6e0c77-e384-43c7-9bb8-4847eda01d27', 'k', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:51:59.455896+00', NULL),
	('bcae45e0-2248-4d2a-8703-2a749552f375', 'z', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:55:10.348048+00', NULL),
	('52431e4d-0e1b-43dc-ac62-bc29bb934691', 'l', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:52:09.302558+00', NULL),
	('5bff0738-c7e5-4041-b160-4c20c2bb86df', 'John Doe', NULL, NULL, 3, '914ffe56-ad31-4dad-b7eb-2cc3fb995d4e', false, '2025-04-12 05:37:29.631179+00', NULL),
	('7e3fbb02-abda-49c7-89bd-9670d3a869e9', 'lll', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:58:09.806862+00', NULL),
	('0df6921c-d97a-465a-9cff-cdf1e9432b76', 'ppp', 20, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:59:22.896077+00', NULL),
	('d29cdeab-5f61-4bc1-a30b-b8e9d1c0e2f9', 'aaa', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:56:01.247293+00', NULL),
	('bfb38231-b738-4192-9fbf-b13f1af1ebf1', 'm', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:52:17.882663+00', NULL),
	('9b782c45-5f28-4035-88c1-10bdaa2f25d8', 'c', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:49:13.160309+00', NULL),
	('e3d0cce5-a9e0-44f5-8798-40f6ebf33915', 'uuu', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 08:00:28.457211+00', NULL),
	('2817a9c9-50e9-4adc-8193-fa5fae821a2d', 'John Doe', NULL, NULL, 1, NULL, false, '2025-04-12 05:49:33.627961+00', NULL),
	('d11aa0f0-fa77-4230-9fb8-f9f156728ad1', 'n', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:52:28.587194+00', NULL),
	('999d6764-e886-43ae-959b-058b34dea1f2', 'bbb', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:56:14.274029+00', NULL),
	('d24e3fae-ff7b-46b6-b5e9-68105409b839', 'o', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:52:50.627041+00', NULL),
	('bca9e58b-5cf2-4694-93e2-7d759a8556b4', 'John Doe', NULL, NULL, 3, '776f48c1-f83c-4d47-8f7c-3958a1b1d116', false, '2025-04-12 05:39:15.838471+00', NULL),
	('080e1fa7-6f43-4183-8ab3-2c72257147d4', 'mmm', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:58:24.256984+00', NULL),
	('4f4a925b-319b-457f-928b-67f89754d11d', 'e', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:49:37.306192+00', NULL),
	('f502cc25-5a85-46cd-a8f6-48d351cb8e66', 'p', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:53:00.300968+00', NULL),
	('a9446878-236d-4be2-9fb8-5b8960ba33ba', 'ccc', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:56:24.760662+00', NULL),
	('c21f1058-d369-4e4f-8e2c-ed3859d41637', 'q', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:53:09.881243+00', NULL),
	('7959b0ec-c2ac-4ef3-b1d6-238fbfd39da8', 'nnn', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:58:35.516543+00', NULL),
	('e717c21d-4df2-49ec-a03f-362b0589b4b2', 'ddd', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:56:35.800227+00', NULL),
	('8024988f-dfe3-4b2a-a970-66ccc457bbbc', 'r', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:53:20.432932+00', NULL),
	('2b655eff-0731-4f91-b047-c456ea383294', 'vvv', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 08:00:40.093398+00', NULL),
	('dbf54f04-38e7-4cb0-9029-a77625578a1f', 's', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:54:01.666125+00', NULL),
	('9f88827e-9da4-4d9c-82fe-bb80f2c61f96', 'eee', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:56:48.144821+00', NULL),
	('51389372-6f9f-4bd8-868a-62648407a363', 't', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:54:10.183581+00', NULL),
	('d325bc80-cd12-4c42-b67e-6d64db602458', 'ooo', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:59:11.904066+00', NULL),
	('b7f56c27-1ff4-4d4e-9df3-e240125f25b8', 'u', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:54:18.799221+00', NULL),
	('4b69e14d-9060-47b4-8539-f5e16ad9cfb8', 'fff', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:56:58.28684+00', NULL),
	('c8463718-7420-439c-ba79-ab4c30afd4af', 'Asd', NULL, NULL, 3, 'c44dd8e1-697e-4b73-9109-432eb957f4d2', false, '2025-02-28 09:14:05.954221+00', NULL),
	('431f3428-d6f7-457b-b1be-cdbdb6e49599', 'v', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:54:27.348025+00', NULL),
	('cd9f87da-d1b3-4cb3-aee8-50b7893e9f21', 'John Doe', NULL, NULL, 1, NULL, false, '2025-04-11 18:21:15.438864+00', NULL),
	('723380ad-ca19-4fff-b5bd-985dfbd042e7', 'www', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 08:00:50.13814+00', NULL),
	('87daf9ca-1023-4389-a88a-0d9fb9607dd2', 'ggg', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:57:09.600162+00', NULL),
	('f42da19b-9d2f-45cb-bbf5-95e742b79314', 'John Doe', NULL, NULL, 3, '10bb5b78-f2f1-499d-a702-a230765937ee', false, '2025-04-12 05:44:56.108805+00', NULL),
	('b14bdd8d-6d0b-4f30-912b-8a8598f70771', 'John Doe', NULL, NULL, 1, NULL, false, '2025-04-11 18:45:37.822469+00', NULL),
	('d89b4bac-ed61-4fb1-bd12-11cfab349f60', 'qqq', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:59:32.499173+00', NULL),
	('842af3e5-e359-4261-84f5-f8dda809071c', 'iii', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:57:31.344708+00', NULL),
	('9a6b4a9c-2636-478e-a220-ebdccaeaacc6', 'a', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:48:44.827307+00', NULL),
	('ae2946e3-bb8f-4115-8ed7-3a4782c63ce2', 'xxx', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 08:01:03.248814+00', NULL),
	('4606aa49-e9c1-4a28-a37b-d78efb20a1e1', 'rrr', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:59:50.576193+00', NULL),
	('095bcbbd-6979-4dda-8c9a-1b8a4417a100', 'hhh', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:57:20.570773+00', NULL),
	('49bb7203-3b06-4dc0-a968-0ae4a75c80ae', 'yyy', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 08:01:14.112628+00', NULL),
	('84eaf5c4-629f-43e3-bf57-e77114501619', 'John Doe', NULL, NULL, 3, '29618a5e-8cc0-4058-a38a-e9ab688702c7', false, '2025-04-11 19:00:23.247354+00', NULL),
	('4e63cae5-a9e4-4cd1-a8a5-f735b811b7ac', 'John Doe', NULL, NULL, 1, NULL, false, '2025-04-12 05:49:50.982872+00', NULL),
	('7073ccb2-acb1-449e-a7da-2debf9464ec4', 'zzz', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 08:01:25.953018+00', NULL),
	('bcb4615c-6496-41bb-8086-ecda2708f55b', 'b', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:48:59.892813+00', NULL),
	('1de4692d-cb9d-4539-a23d-a19bbcef35a7', 'h', NULL, NULL, 1, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:50:18.557523+00', NULL),
	('032591c8-7d96-4f57-9621-6991a124f72a', 'd', 20, NULL, 3, '47882b18-48cc-445a-a866-a4187ac9592e', false, '2025-03-21 07:49:24.730495+00', NULL),
	('34267e24-052d-4394-848b-ff72794018ef', 'John Doe', NULL, NULL, 1, NULL, false, '2025-04-12 05:49:10.968274+00', NULL);


--
-- Data for Name: schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: submission; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."submission" ("id", "user_id", "company_id", "training_id", "answers", "created_at") VALUES
	('a556a7ad-9b17-4ad5-b0a8-2ccf22416d48', 'bcb4615c-6496-41bb-8086-ecda2708f55b', '47882b18-48cc-445a-a866-a4187ac9592e', 'a556a7ad-9b17-4ad5-b0a8-2ccf22416d48', '[{"id": "8b1afe91-bfb8-4d53-853c-d01690fb5b71", "answers": ["hihi"]}]', '2025-04-09 11:23:34.523525+00'),
	('160fbb3e-540a-4713-9a88-6e6cd371795a', 'bcb4615c-6496-41bb-8086-ecda2708f55b', '47882b18-48cc-445a-a866-a4187ac9592e', '160fbb3e-540a-4713-9a88-6e6cd371795a', '[{"id": "c9f02e68-34d7-4926-a8b3-05d60662c45c", "answers": ["rgtggrg54g445g5"]}]', '2025-04-09 12:30:29.900512+00'),
	('13861380-7dd7-4fe0-8336-80d7a1017cc6', '032591c8-7d96-4f57-9621-6991a124f72a', '47882b18-48cc-445a-a866-a4187ac9592e', '0fd1b684-97f8-46b7-8c52-08bd54fd4c5a', '[{"id": "c7ef1a39-c2b5-49bd-ba2e-76ec7ecf8b2f", "answers": ["fdfdgrgegdrgd"]}]', '2025-04-11 07:02:38.541977+00'),
	('2118aa9b-b067-4e36-9154-2465813a2c71', '032591c8-7d96-4f57-9621-6991a124f72a', '47882b18-48cc-445a-a866-a4187ac9592e', '160fbb3e-540a-4713-9a88-6e6cd371795a', '[{"id": "c9f02e68-34d7-4926-a8b3-05d60662c45c", "answers": ["grggg5g4gg"]}]', '2025-04-11 07:03:15.046639+00');


--
-- Data for Name: ticket; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ticket" ("id", "title", "content", "closed", "user_id", "created_at", "company_id") VALUES
	('ead85d5f-d53d-4e5e-b73b-7f124f6b26e8', 'scscsdcsdcsc', 'sdcsdcccsdcd', false, 'c8463718-7420-439c-ba79-ab4c30afd4af', '2025-03-02 12:53:00.435254+00', NULL),
	('aa1647b3-7289-467d-a8c0-702ee727fcf7', 'Help me', 'I am under the water, please help me, blugglug.', true, 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', '2025-03-03 07:53:43.616859+00', 'c44dd8e1-697e-4b73-9109-432eb957f4d2'),
	('25f9e649-8706-4f62-ae46-02c13ab49fd1', 'dfdfgdfghdfg', 'dgdfgdfdgfg', false, 'c8463718-7420-439c-ba79-ab4c30afd4af', '2025-03-02 12:56:49.280357+00', NULL),
	('d98248d8-be03-4942-8002-630993d68c8c', 'dfdfgdfghdfg', 'dgdfgdfdgfg', true, 'c8463718-7420-439c-ba79-ab4c30afd4af', '2025-03-02 12:57:05.511548+00', NULL),
	('9cfa0239-2465-4837-be1c-b58235aee7b8', 'Help me again', 'I am under the water, please help me, blugglug.', true, 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', '2025-03-03 07:55:39.045041+00', NULL),
	('0fd3a20d-5c44-4205-8133-4fd0c77fe017', 'Hello World!', 'This is a test. Hihihihaha.', false, '032591c8-7d96-4f57-9621-6991a124f72a', '2025-03-21 18:31:58.506546+00', NULL),
	('7cc79f73-68be-46da-a00f-9710f9105514', 'testtesttest', 'testtesttest', false, '032591c8-7d96-4f57-9621-6991a124f72a', '2025-04-01 17:37:36.055698+00', NULL),
	('3d8a3c8b-2c8d-4061-aca8-831d77c61310', 'Hello World!', 'What is going on?', false, '032591c8-7d96-4f57-9621-6991a124f72a', '2025-04-12 06:42:29.249093+00', NULL);


--
-- Data for Name: ticket_response; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ticket_response" ("id", "content", "user_id", "ticket_id", "created_at") VALUES
	('34601be0-bb4a-41d6-8d22-dc0589857798', 'efgerteggerg', 'c8463718-7420-439c-ba79-ab4c30afd4af', 'ead85d5f-d53d-4e5e-b73b-7f124f6b26e8', '2025-03-02 13:31:53.628276+00'),
	('e40c39c7-073b-43a8-8f76-6535de49aa50', 'sdfdfvsfsfsfsdf', 'c8463718-7420-439c-ba79-ab4c30afd4af', 'ead85d5f-d53d-4e5e-b73b-7f124f6b26e8', '2025-03-02 13:32:49.980145+00'),
	('ec679a7c-408d-41b1-b996-d8a2cb4d94cb', 'rgbergvergerferfer', 'c8463718-7420-439c-ba79-ab4c30afd4af', 'ead85d5f-d53d-4e5e-b73b-7f124f6b26e8', '2025-03-02 13:55:15.710019+00'),
	('577f9bdd-0b64-4d07-b0ea-120e81ab19d6', 'dsfsdfdsfsdfsdfsdf', 'c8463718-7420-439c-ba79-ab4c30afd4af', 'ead85d5f-d53d-4e5e-b73b-7f124f6b26e8', '2025-03-02 14:04:32.963651+00'),
	('90137894-48e7-4b45-9cfd-d53654b0af0a', 'Hello World!', 'c8463718-7420-439c-ba79-ab4c30afd4af', '25f9e649-8706-4f62-ae46-02c13ab49fd1', '2025-03-02 14:16:22.376179+00'),
	('29188f13-4107-4ba8-b5db-9ce89a63c1db', 'Hello World!', 'c8463718-7420-439c-ba79-ab4c30afd4af', '25f9e649-8706-4f62-ae46-02c13ab49fd1', '2025-03-02 14:16:37.893524+00'),
	('beab4e27-96ba-4fd3-a262-ed70a60bcd19', 'What is the problem?', 'c8463718-7420-439c-ba79-ab4c30afd4af', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-03 07:56:29.617681+00'),
	('dd340dfc-3f96-4165-ba84-f28f803bafce', 'I dont know. Just help me, please!', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-03 07:56:58.151139+00'),
	('9e04192e-2fc9-40dd-99db-831d2fc1c4ab', 'Yeah, yeah, okay.', 'cc331223-411c-4390-a6e0-6b4e0c80aea2', '25f9e649-8706-4f62-ae46-02c13ab49fd1', '2025-03-04 14:46:21.716837+00'),
	('0dee805b-7aaf-4567-a96d-9d73cc5538b8', 'Hello again', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-04 15:06:55.143433+00'),
	('26243909-7156-4955-be9c-8e52f172935d', 'Hello again', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-04 15:06:58.001963+00'),
	('18c9ff50-30c6-4152-900a-e1e0e67293f2', 'Hello again', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-04 15:06:58.913319+00'),
	('ecc0ba5d-5e79-46fa-983d-2490740f962b', 'Hello again', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-04 15:06:59.664164+00'),
	('59efd1cd-9ea1-464d-843b-8f6fb0eea68a', 'Hello again', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-04 15:07:00.412736+00'),
	('7ab9c8cb-f9ed-4793-9f37-6c8ac0293893', 'Hello again', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-04 15:07:01.125745+00'),
	('89c1ff19-92c4-494c-9e28-4017f8d41c02', 'Hello again', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-04 15:07:01.850545+00'),
	('ff719c90-d257-48a1-9d45-7bdeb166fc88', 'Hello again', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-04 15:07:03.614887+00'),
	('a4c4dde9-46df-4308-b35f-bce9bb188e0e', 'Hello again', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-04 15:07:07.956655+00'),
	('7126c12d-efa4-4edb-8d15-bc862272ae2c', 'Hello again', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-04 15:07:08.904153+00'),
	('3c6364e7-00a0-47da-8da5-7268fffdcae2', 'How are you?', 'cde7fa37-4e29-42d5-b836-b7bc3b72b06d', 'aa1647b3-7289-467d-a8c0-702ee727fcf7', '2025-03-04 15:25:54.583414+00'),
	('dcba94e9-dd31-42f0-a1ce-773d182c1889', 'Hello World!', '032591c8-7d96-4f57-9621-6991a124f72a', '0fd3a20d-5c44-4205-8133-4fd0c77fe017', '2025-03-21 18:32:11.870035+00'),
	('8a6ba8bf-501e-4bf9-be3f-cc56b5daf9bf', 'Hello hello', '032591c8-7d96-4f57-9621-6991a124f72a', '3d8a3c8b-2c8d-4061-aca8-831d77c61310', '2025-04-12 06:44:27.356217+00'),
	('d5007f34-d0f8-4cf2-854d-dedd33372f49', 'Hello World!', '032591c8-7d96-4f57-9621-6991a124f72a', '3d8a3c8b-2c8d-4061-aca8-831d77c61310', '2025-04-12 06:47:18.491898+00');


--
-- Data for Name: training_in_progress; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."training_in_progress" ("id", "user_id", "training_id") VALUES
	('a9157897-03d3-468f-b56a-16307db69438', 'bcb4615c-6496-41bb-8086-ecda2708f55b', 'a556a7ad-9b17-4ad5-b0a8-2ccf22416d48');


--
-- PostgreSQL database dump complete
--

RESET ALL;
